"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { ITEM_MAX, LIST_MAX, tagToAdd } from "@/lib/profile-draft";

/**
 * Список-массив: чипы с удалением и поле, которое добавляет по Enter или по
 * кнопке. Весь чип — одна кнопка, поэтому цель нажатия остаётся крупной.
 */
export function TagEditor({
  id,
  label,
  hint,
  placeholder,
  emptyNote,
  items,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  emptyNote: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const full = items.length >= LIST_MAX;

  function add() {
    const next = tagToAdd(value, items);
    if (!next.ok) {
      setError(next.error);
      return;
    }
    onChange([...items, next.value]);
    setValue("");
    setError(null);
  }

  function remove(item: string) {
    onChange(items.filter((entry) => entry !== item));
    setError(null);
  }

  return (
    <Field label={label} hint={hint} htmlFor={id} error={error ?? undefined}>
      {items.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-x-2">
          {items.map((item) => (
            <li key={item}>
              {/* Чип — плашка, но цель нажатия остаётся высотой в строку. */}
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={`Удалить «${item}»`}
                className="flex h-10 items-center rounded-pill"
              >
                <Pill>
                  {item}
                  <Icon name="close" size={13} className="text-ink-faint" />
                </Pill>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pb-1 text-[14px] text-ink-faint">{emptyNote}</p>
      )}

      <div className="flex gap-2">
        <TextInput
          id={id}
          value={value}
          placeholder={placeholder}
          maxLength={ITEM_MAX}
          autoComplete="off"
          disabled={full}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            add();
          }}
        />
        <Button type="button" variant="quiet" onClick={add} disabled={full} className="shrink-0">
          Добавить
        </Button>
      </div>

      <p className="u-tnum text-right text-[12px] text-ink-faint">
        {items.length}/{LIST_MAX}
        {full ? " — удали что-нибудь, чтобы добавить новое" : ""}
      </p>
    </Field>
  );
}
