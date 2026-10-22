"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Кнопка серверной формы: выключена, пока запрос идёт, — дважды не уйдёт. */
export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" full disabled={pending} aria-busy={pending || undefined}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
