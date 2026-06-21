import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getCustomerDocumentData } from "@/lib/medical/documents";
import { formatBytes, mimeLabel } from "@/lib/medical/constants";
import { DEFAULT_CUSTOMER_TZ, formatInTz } from "@/lib/timezone";
import { MedicalDocuments } from "@/components/dashboard/MedicalDocuments";

export const metadata = { title: "Health documents" };

export default async function DocumentsPage() {
  const { user, supabase } = await requireUser("/dashboard/documents");
  const [{ data: profile }, data] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
    getCustomerDocumentData(supabase, user.id),
  ]);
  const tz = profile?.timezone ?? DEFAULT_CUSTOMER_TZ;

  const documents = data.documents.map((d) => ({
    id: d.id,
    file_name: d.file_name,
    type_label: mimeLabel(d.mime_type),
    size_label: formatBytes(d.size_bytes),
    created_label: formatInTz(d.created_at, tz, "d MMM yyyy"),
    note: d.note,
    shares: d.shares.map((s) => ({
      teacher_id: s.teacher_id,
      teacher_name: s.teacher_name ?? "Teacher",
    })),
  }));

  const accessLog = data.accessLog.map((l) => ({
    file_name: l.file_name,
    accessor_label: l.accessor_label,
    when: formatInTz(l.created_at, tz, "d MMM, h:mm a"),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="myc-eyebrow">
        <span className="myc-dot" />
        Health documents
      </div>
      <div className="mt-2">
        <h1 className="font-[family-name:var(--font-cormorant)] text-4xl md:text-[2.7rem] leading-[1.05] tracking-tight">
          Your private <span className="italic text-accent">records.</span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Upload medical reports for your teacher to review before a session. Files
          are private to you — a teacher can only open one after you explicitly
          share it, and you can revoke access any time.
        </p>
      </div>

      <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-[13px] text-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Stored encrypted in a private vault. Nobody — not even studio admins —
          can see a document unless you share it. Every time a teacher opens a
          file, it&apos;s recorded below.
        </p>
      </div>

      <MedicalDocuments
        userId={user.id}
        documents={documents}
        bookedTeachers={data.bookedTeachers}
        accessLog={accessLog}
      />
    </div>
  );
}
