"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export type ReviewRow = {
  id: string;
  rating: number;
  body: string | null;
  is_featured: boolean;
  is_approved: boolean;
  display_name_override: string | null;
  display_location: string | null;
  created_at: string;
  customer_id: string;
  teacher_id: string | null;
  customer: { id: string; full_name: string | null; email: string | null } | null;
  teacher: { id: string; display_name: string } | null;
};

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

export function ReviewsAdmin({ rows }: { rows: ReviewRow[] }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReviewRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function toggle(id: string, field: "is_approved" | "is_featured", currentValue: boolean) {
    setBusy(`${id}-${field}`);
    const patch = { [field]: !currentValue } as { is_approved?: boolean; is_featured?: boolean };
    const { error } = await supabase.from("reviews").update(patch).eq("id", id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const label =
      field === "is_approved"
        ? !currentValue
          ? "Review approved."
          : "Review unapproved."
        : !currentValue
        ? "Review featured."
        : "Review unfeatured.";
    toast.success(label);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("reviews").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Review deleted.");
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Author</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Teacher</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rating</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground max-w-xs">Body</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const authorName =
                r.display_name_override ??
                r.customer?.full_name ??
                r.customer?.email ??
                "Unknown";
              const location = r.display_location;
              const approveBusyKey = `${r.id}-is_approved`;
              const featuredBusyKey = `${r.id}-is_featured`;

              return (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium leading-tight">{authorName}</div>
                    {location && (
                      <div className="text-xs text-muted-foreground mt-0.5">{location}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.teacher?.display_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StarRating rating={r.rating} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs">
                    {r.body ? (
                      <span className="line-clamp-2">{r.body}</span>
                    ) : (
                      <span className="italic">No body</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant={r.is_approved ? "default" : "secondary"}
                        className="w-fit text-xs"
                      >
                        {r.is_approved ? "Approved" : "Pending"}
                      </Badge>
                      {r.is_featured && (
                        <Badge variant="outline" className="w-fit text-xs">
                          Featured
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === approveBusyKey}
                        onClick={() => toggle(r.id, "is_approved", r.is_approved)}
                        className="h-7 text-xs"
                      >
                        {busy === approveBusyKey ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : r.is_approved ? (
                          "Unapprove"
                        ) : (
                          "Approve"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === featuredBusyKey}
                        onClick={() => toggle(r.id, "is_featured", r.is_featured)}
                        className="h-7 text-xs"
                      >
                        {busy === featuredBusyKey ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : r.is_featured ? (
                          "Unfeature"
                        ) : (
                          "Feature"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="text-center px-4 py-12 text-muted-foreground"
                >
                  No reviews yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete review?</DialogTitle>
            <DialogDescription>
              This will permanently remove the review by{" "}
              <strong>
                {deleteTarget?.display_name_override ??
                  deleteTarget?.customer?.full_name ??
                  deleteTarget?.customer?.email ??
                  "this customer"}
              </strong>
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
