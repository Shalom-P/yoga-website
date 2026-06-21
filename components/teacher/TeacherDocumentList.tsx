"use client";

import { useState } from "react";
import { FileText, Download, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type DocView = {
  id: string;
  file_name: string;
  type_label: string;
  size_label: string;
  note: string | null;
};
type StudentGroup = {
  customer_id: string;
  student_name: string;
  documents: DocView[];
};

export function TeacherDocumentList({ students }: { students: StudentGroup[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function open(doc: DocView) {
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/medical-documents/${doc.id}/download`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        toast.error(
          body.error === "not_found"
            ? "This document is no longer shared with you."
            : `Couldn't open: ${body.error ?? "unknown"}`,
        );
        return;
      }
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {students.map((group) => (
        <section
          key={group.customer_id}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-border bg-background px-5 py-3">
            <UserRound className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{group.student_name}</h2>
            <span className="text-xs text-muted-foreground">
              · {group.documents.length} document{group.documents.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {group.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.type_label}
                      {doc.size_label ? ` · ${doc.size_label}` : ""}
                    </p>
                    {doc.note && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground italic">
                        “{doc.note}”
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => void open(doc)}
                  disabled={busyId === doc.id}
                >
                  {busyId === doc.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  Open
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
