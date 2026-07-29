import { FileText } from "lucide-react";
import { requireTeacher } from "@/lib/auth/guards";
import { getTeacherSharedDocuments } from "@/lib/medical/documents";
import { formatBytes, mimeLabel } from "@/lib/medical/constants";
import { TeacherDocumentList } from "@/components/teacher/TeacherDocumentList";
import { PhiReplayGuard } from "@/components/shared/PhiReplayGuard";

export const metadata = { title: "Student documents" };

export default async function TeacherDocumentsPage() {
  const { user, supabase } = await requireTeacher();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  const groups = teacher ? await getTeacherSharedDocuments(teacher.id) : [];
  const students = groups.map((g) => ({
    customer_id: g.customer_id,
    student_name: g.student_name ?? "Student",
    documents: g.documents.map((d) => ({
      id: d.id,
      file_name: d.file_name,
      type_label: mimeLabel(d.mime_type),
      size_label: formatBytes(d.size_bytes),
      note: d.note,
    })),
  }));

  return (
    <div data-phi className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <PhiReplayGuard />
      <header>
        <h1 className="text-3xl font-[family-name:var(--font-heading)] tracking-tight">
          Student documents
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Medical reports your students have chosen to share with you. Please treat
          them as confidential. Each time you open a file, the student is notified
          in their access history. A student can revoke access at any time.
        </p>
      </header>

      {students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No documents have been shared with you yet.
          </p>
        </div>
      ) : (
        <TeacherDocumentList students={students} />
      )}
    </div>
  );
}
