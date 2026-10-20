"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import type { Category } from "@/lib/types";

/** Категории за чипом «Другое»: список с отметками, выбор — сразу, без «Применить». */
export function OtherCategoriesSheet({
  open,
  onClose,
  categories,
  selected,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  selected: readonly string[];
  onToggle: (id: string) => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Другие категории"
      footer={
        <Button full size="lg" onClick={onClose}>
          Закрыть
        </Button>
      }
    >
      <ul className="space-y-0.5">
        {categories.map((category) => {
          const on = selected.includes(category.id);
          return (
            <li key={category.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(category.id)}
                className={[
                  "flex min-h-11 w-full items-center gap-3 rounded-field px-2.5 py-2 text-left text-[15px] transition-colors",
                  on ? "text-signal" : "text-ink hover:bg-sunken",
                ].join(" ")}
              >
                <Icon name={category.icon} size={18} className={on ? "shrink-0" : "shrink-0 text-ink-soft"} />
                <span className="min-w-0 flex-1 truncate">{category.name}</span>
                {on ? <Icon name="check" size={18} className="shrink-0" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
