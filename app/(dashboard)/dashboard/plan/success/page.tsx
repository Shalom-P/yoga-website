import { Suspense } from "react";
import { PlanSuccessConfirm } from "@/components/dashboard/PlanSuccessConfirm";

export default function PlanSuccessPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Confirming…</p>}>
        <PlanSuccessConfirm />
      </Suspense>
    </div>
  );
}
