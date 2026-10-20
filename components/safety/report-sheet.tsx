"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { report } from "@/app/actions/safety";
import { Button } from "@/components/ui/button";
import { CharCount, Field, RadioRow, TextArea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { notify } from "@/components/ui/toast";
import type { ReportReason, ReportTarget } from "@/lib/types";

const MAX_DETAILS = 1000;

/** Причины в порядке частоты, как в формах Instagram и Discord. */
export const reportReasons: { value: ReportReason; label: string; description?: string }[] = [
  { value: "spam", label: "Спам или реклама" },
  {
    value: "harassment",
    label: "Оскорбления или травля",
    description: "Унижает, преследует, угрожает раскрыть личное.",
  },
  {
    value: "hate",
    label: "Ненависть или дискриминация",
    description: "Из-за происхождения, религии, пола, ориентации.",
  },
  { value: "sexual", label: "Откровенный или сексуальный контент" },
  { value: "violence", label: "Угрозы или насилие" },
  { value: "scam", label: "Мошенничество", description: "Просит деньги, данные карты, пароль." },
  { value: "impersonation", label: "Выдаёт себя за другого" },
  { value: "other", label: "Другое", description: "Опиши, что не так." },
];

const subjectLabel: Record<ReportTarget, string> = {
  user: "профиль",
  post: "идею",
  message: "сообщение",
  direct_message: "сообщение",
};

/**
 * Жалоба: причина и, если нужно, пара слов. Жалоба анонимна для того, на
 * кого жалуются, — так устроены все крупные сети, иначе люди боятся писать.
 * Что происходит дальше, описано в docs/MODERATION.md.
 */
export function ReportSheet({
  open,
  onClose,
  targetType,
  targetId,
  subject,
}: {
  open: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
  /** Чей контент — для заголовка: «Пожаловаться на сообщение от jonas_k». */
  subject?: string;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Свои name и id у каждого листа: два открытых сразу не делят одну радиогруппу.
  const uid = useId();
  const groupName = `report-reason-${uid}`;
  const detailsId = `report-details-${uid}`;

  // Новый лист — новая жалоба.
  useEffect(() => {
    if (!open) return;
    setReason(null);
    setDetails("");
    setError(null);
  }, [open, targetId]);

  const needsDetails = reason === "other";
  const ready =
    reason !== null && (!needsDetails || details.trim().length > 0) && details.length <= MAX_DETAILS;

  function submit() {
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      const result = await report(targetType, targetId, reason, details.trim() || null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      notify("Жалоба отправлена. Спасибо, что сказал — мы посмотрим.", "info");
    });
  }

  const title = `Пожаловаться на ${subjectLabel[targetType]}${subject ? ` ${subject}` : ""}`;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button
          type="button"
          variant="danger"
          size="lg"
          full
          disabled={!ready || pending}
          aria-busy={pending}
          onClick={submit}
        >
          Отправить жалобу
        </Button>
      }
    >
      <fieldset className="space-y-2">
        <legend className="pb-2 text-[14px] leading-[1.4] text-ink-soft">
          Что не так? Тот, на кого жалуются, не узнает, кто пожаловался.
        </legend>
        {reportReasons.map((item) => (
          <RadioRow
            key={item.value}
            name={groupName}
            value={item.value}
            checked={reason === item.value}
            onChange={() => setReason(item.value)}
            label={item.label}
            description={item.description}
          />
        ))}
      </fieldset>

      <div className="mt-4">
        <Field label="Подробности" htmlFor={detailsId} required={needsDetails} error={error ?? undefined}>
          <TextArea
            id={detailsId}
            rows={3}
            value={details}
            maxLength={MAX_DETAILS + 100}
            onChange={(event) => setDetails(event.target.value)}
            placeholder={needsDetails ? "Что произошло?" : "Если хочешь, добавь пару слов"}
          />
          <CharCount value={details} max={MAX_DETAILS} />
        </Field>
      </div>
    </Sheet>
  );
}
