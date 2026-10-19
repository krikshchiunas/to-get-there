"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ChipButton } from "@/components/ui/pill";
import { Sheet } from "@/components/ui/sheet";
import type { Category } from "@/lib/types";

/** Focus target, so the form can jump here when no category is picked. */
export const CATEGORY_GROUP_ID = "create-category";

/**
 * The eight main categories sit in the open; the rest live behind "Другое".
 * Whatever is picked in the sheet joins the row as a selected chip, so the
 * choice is always visible without opening anything.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  invalid = false,
}: {
  /** Весь справочник. Загружает серверная страница. */
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string) => void;
  invalid?: boolean;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const mainCategories = categories.filter((category) => category.is_main);
  const otherCategories = categories.filter((category) => !category.is_main);
  const selectedOther = otherCategories.find((category) => category.id === value);

  return (
    <>
      <div
        id={CATEGORY_GROUP_ID}
        tabIndex={-1}
        role="group"
        aria-label="Категория"
        className={[
          "flex flex-wrap gap-2",
          // role="group" не поддерживает aria-invalid, поэтому незаполненная
          // категория показывается рамкой; текст ошибки объявляет Field
          // через role="alert".
          invalid ? "rounded-field p-2 -m-2 ring-1 ring-heat/50" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {mainCategories.map((category) => (
          <ChipButton
            key={category.id}
            icon={category.icon}
            active={value === category.id}
            onClick={() => onChange(category.id)}
          >
            {category.name}
          </ChipButton>
        ))}

        {selectedOther ? (
          <ChipButton icon={selectedOther.icon} active onClick={() => setSheetOpen(true)}>
            {selectedOther.name}
          </ChipButton>
        ) : null}

        <ChipButton icon="more" onClick={() => setSheetOpen(true)}>
          Другое
        </ChipButton>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Другие категории">
        <ul className="space-y-0.5">
          {otherCategories.map((category) => {
            const selected = value === category.id;
            return (
              <li key={category.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(category.id);
                    setSheetOpen(false);
                  }}
                  className={[
                    "flex min-h-11 w-full items-center gap-3 rounded-field px-2 py-2 text-left text-[15px] transition-colors",
                    selected ? "text-signal" : "text-ink hover:bg-sunken",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      selected ? "bg-signal-wash text-signal" : "bg-sunken text-ink-soft",
                    ].join(" ")}
                  >
                    <Icon name={category.icon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  {selected ? <Icon name="check" size={18} className="shrink-0" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
