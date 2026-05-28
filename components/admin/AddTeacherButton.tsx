"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeacherFormDialog } from "./TeacherFormDialog";

export function AddTeacherButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="rounded-full" onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1" />
        Add teacher
      </Button>
      <TeacherFormDialog open={open} onOpenChange={setOpen} teacher={null} redirectAfterCreate />
    </>
  );
}
