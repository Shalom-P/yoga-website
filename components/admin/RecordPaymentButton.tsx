"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import type { PackOption } from "./PaymentsAdmin";

export function RecordPaymentButton({ plans }: { plans: PackOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1" />
        Record a payment
      </Button>
      <RecordPaymentDialog open={open} onOpenChange={setOpen} plans={plans} />
    </>
  );
}
