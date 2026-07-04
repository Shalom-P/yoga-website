import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

// Server-only data access for the secure medical-document feature.
//
// Two access tiers, mirroring lib/teacher/sessions.ts:
//   * Customer-facing reads run on the caller's RLS-bound client (passed in) —
//     the owner_select / owner_read policies in 0027 already scope them to self.
//   * Teacher-facing reads run on the SERVICE-ROLE client, because a teacher
//     needs the student's name (profiles is self/admin-only under RLS) and the
//     0027 teacher_read policy alone wouldn't expose it. The teacher_id is
//     derived from requireTeacher() + the teachers row, never client-supplied.

export type CustomerDocumentShare = {
  teacher_id: string;
  teacher_name: string | null;
  shared_at: string;
};

export type CustomerDocument = {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  note: string | null;
  created_at: string;
  shares: CustomerDocumentShare[];
};

export type BookedTeacher = { id: string; display_name: string };

export type AccessLogEntry = {
  document_id: string;
  file_name: string;
  accessor_label: string;
  created_at: string;
};

export type CustomerDocumentData = {
  documents: CustomerDocument[];
  bookedTeachers: BookedTeacher[];
  accessLog: AccessLogEntry[];
};

type Db = SupabaseClient<Database>;

/**
 * True when the customer has at least one live (non-deleted) medical document.
 *
 * Powers the "upload before your class" nudge. Works on either client: the
 * RLS-bound server client (owner_select scopes it to self) for the dashboard,
 * or the service-role client in the reminder cron (scoped explicitly by
 * customer_id). On error it fails "quiet" — returns `true` so we never nag a
 * customer because of a transient query failure or a missing table.
 */
export async function hasMedicalDocuments(supabase: Db, customerId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("medical_documents")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .is("deleted_at", null);
  if (error) {
    console.error("hasMedicalDocuments failed", { customerId, error: error.message });
    return true;
  }
  return (count ?? 0) > 0;
}

/**
 * Everything the customer's "Health documents" page needs, fetched on their own
 * RLS-bound client so each query is self-scoped by policy.
 */
export async function getCustomerDocumentData(
  supabase: Db,
  uid: string,
): Promise<CustomerDocumentData> {
  const [docsRes, sharesRes, bookingsRes, logRes] = await Promise.all([
    supabase
      .from("medical_documents")
      .select("id, file_name, mime_type, size_bytes, note, created_at")
      .eq("customer_id", uid)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("medical_document_shares")
      .select("document_id, teacher_id, created_at, teacher:teachers(display_name)")
      .is("revoked_at", null),
    supabase
      .from("bookings")
      .select("session:sessions(teacher:teachers(id, display_name))")
      .eq("customer_id", uid),
    supabase
      .from("medical_document_access_log")
      .select("document_id, accessed_by, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const sharesByDoc = new Map<string, CustomerDocumentShare[]>();
  for (const s of sharesRes.data ?? []) {
    const arr = sharesByDoc.get(s.document_id) ?? [];
    arr.push({
      teacher_id: s.teacher_id,
      teacher_name: s.teacher?.display_name ?? null,
      shared_at: s.created_at,
    });
    sharesByDoc.set(s.document_id, arr);
  }

  const documents: CustomerDocument[] = (docsRes.data ?? []).map((d) => ({
    id: d.id,
    file_name: d.file_name,
    mime_type: d.mime_type,
    size_bytes: d.size_bytes,
    note: d.note,
    created_at: d.created_at,
    shares: sharesByDoc.get(d.id) ?? [],
  }));

  // Distinct teachers this customer has booked — the only people they may share with.
  const bookedMap = new Map<string, string>();
  for (const b of bookingsRes.data ?? []) {
    const t = b.session?.teacher;
    if (t?.id) bookedMap.set(t.id, t.display_name);
  }
  const bookedTeachers: BookedTeacher[] = [...bookedMap.entries()]
    .map(([id, display_name]) => ({ id, display_name }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  // Resolve accessor labels: self → "You"; otherwise map the auth id to a teacher
  // display name (teachers is public-read), else a generic label.
  const log = logRes.data ?? [];
  const otherIds = [
    ...new Set(log.map((l) => l.accessed_by).filter((id): id is string => !!id && id !== uid)),
  ];
  const teacherNameByProfile = new Map<string, string>();
  if (otherIds.length > 0) {
    const { data: ts } = await supabase
      .from("teachers")
      .select("profile_id, display_name")
      .in("profile_id", otherIds);
    for (const t of ts ?? []) {
      if (t.profile_id) teacherNameByProfile.set(t.profile_id, t.display_name);
    }
  }
  const fileNameById = new Map(documents.map((d) => [d.id, d.file_name]));
  const accessLog: AccessLogEntry[] = log
    .filter((l) => fileNameById.has(l.document_id))
    .map((l) => ({
      document_id: l.document_id,
      file_name: fileNameById.get(l.document_id) ?? "Document",
      accessor_label:
        l.accessed_by === uid
          ? "You"
          : (l.accessed_by && teacherNameByProfile.get(l.accessed_by)) || "A teacher",
      created_at: l.created_at,
    }));

  return { documents, bookedTeachers, accessLog };
}

export type TeacherSharedDocument = {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  note: string | null;
  shared_at: string;
};

export type TeacherStudentDocuments = {
  customer_id: string;
  student_name: string | null;
  documents: TeacherSharedDocument[];
};

/**
 * Documents currently shared with a teacher, grouped by student. Service-role
 * (gated by requireTeacher + a server-derived teacherId) so the student's name
 * resolves — RLS would otherwise hide profiles from a teacher.
 */
export async function getTeacherSharedDocuments(
  teacherId: string,
): Promise<TeacherStudentDocuments[]> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("medical_document_shares")
    .select(
      `created_at,
       document:medical_documents(
         id, file_name, mime_type, size_bytes, note, created_at, deleted_at, customer_id,
         customer:profiles(full_name)
       )`,
    )
    .eq("teacher_id", teacherId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTeacherSharedDocuments failed", { teacherId, error: error.message });
    return [];
  }

  const byStudent = new Map<string, TeacherStudentDocuments>();
  for (const row of data ?? []) {
    const doc = row.document;
    if (!doc || doc.deleted_at) continue; // defensive: deletes revoke shares anyway
    const group = byStudent.get(doc.customer_id) ?? {
      customer_id: doc.customer_id,
      student_name: doc.customer?.full_name ?? null,
      documents: [],
    };
    group.documents.push({
      id: doc.id,
      file_name: doc.file_name,
      mime_type: doc.mime_type,
      size_bytes: doc.size_bytes,
      note: doc.note,
      shared_at: row.created_at,
    });
    byStudent.set(doc.customer_id, group);
  }

  return [...byStudent.values()].sort((a, b) =>
    (a.student_name ?? "").localeCompare(b.student_name ?? ""),
  );
}
