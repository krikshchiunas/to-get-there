"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const FORM_ID = "poll-composer-form";

type Row = { key: string; label: string };

function emptyRows(): Row[] {
  return [
    { key: "option-0", label: "" },
    { key: "option-1", label: "" },
  ];
}

/** Two to six options, a question, and everyone sees the result. */
export function PollComposer({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[]) => void;
}) {
  const [question, setQuestion] = useState("");
  const [rows, setRows] = useState<Row[]>(emptyRows);
  const nextKey = useRef(MIN_OPTIONS - 1);

  const filled = rows.map((row) => row.label.trim()).filter((label) => label.length > 0);
  const ready = question.trim().length > 0 && filled.length >= MIN_OPTIONS;

  function addRow() {
    if (rows.length >= MAX_OPTIONS) return;
    nextKey.current += 1;
    const key = `option-${nextKey.current}`;
    setRows((previous) => [...previous, { key, label: "" }]);
  }

  function removeRow(key: string) {
    setRows((previous) =>
      previous.length <= MIN_OPTIONS ? previous : previous.filter((row) => row.key !== key),
    );
  }

  function setLabel(key: string, label: string) {
    setRows((previous) => previous.map((row) => (row.key === key ? { ...row, label } : row)));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;

    onCreate(question.trim(), filled);

    setQuestion("");
    setRows(emptyRows());
    nextKey.current = MIN_OPTIONS - 1;
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Создать голосование"
      footer={
        <Button type="submit" form={FORM_ID} full size="lg" disabled={!ready}>
          Создать голосование
        </Button>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <Field label="Вопрос" htmlFor="poll-question" required hint="Результаты видят все в чате.">
          <TextInput
            id="poll-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Во сколько встречаемся?"
            maxLength={120}
            autoComplete="off"
          />
        </Field>

        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.key} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field
                  label={`Вариант ${index + 1}`}
                  htmlFor={`poll-${row.key}`}
                  required={index < MIN_OPTIONS}
                >
                  <TextInput
                    id={`poll-${row.key}`}
                    value={row.label}
                    onChange={(event) => setLabel(row.key, event.target.value)}
                    maxLength={60}
                    autoComplete="off"
                  />
                </Field>
              </div>

              {rows.length > MIN_OPTIONS ? (
                <IconButton
                  type="button"
                  label={`Удалить вариант ${index + 1}`}
                  onClick={() => removeRow(row.key)}
                >
                  <Icon name="close" size={18} />
                </IconButton>
              ) : null}
            </div>
          ))}
        </div>

        {rows.length < MAX_OPTIONS ? (
          <Button type="button" variant="quiet" onClick={addRow}>
            <Icon name="plus" size={16} />
            Добавить вариант
          </Button>
        ) : (
          <p className="text-[13px] text-ink-faint">Больше шести вариантов не получится.</p>
        )}
      </form>
    </Sheet>
  );
}
