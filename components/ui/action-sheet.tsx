"use client";

import type { ReactNode } from "react";
import type { IconName } from "@/lib/types";
import { Button } from "./button";
import { Icon } from "./icon";
import { Sheet } from "./sheet";

export interface SheetAction {
  label: string;
  icon: IconName;
  onSelect: () => void;
  /** Деструктивное действие — красным, как и везде в приложении. */
  danger?: boolean;
}

/**
 * Меню «⋯»: список действий в нижнем листе. Так делают Instagram и Threads
 * на телефоне — меню у края пальца, а не всплывающий список под кнопкой,
 * до которого не дотянуться. Лист закрывается до запуска действия, чтобы
 * следующий лист (подтверждение, жалоба) открывался уже поверх ленты.
 */
export function ActionSheet({
  open,
  onClose,
  title,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  actions: SheetAction[];
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ul className="-mx-4 -my-4 py-1.5">
        {actions.map((action) => (
          <li key={action.label}>
            <button
              type="button"
              onClick={() => {
                onClose();
                action.onSelect();
              }}
              className={`flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] transition-colors hover:bg-sunken ${
                action.danger ? "text-heat" : "text-ink"
              }`}
            >
              <Icon name={action.icon} size={19} className={action.danger ? "" : "text-ink-soft"} />
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/**
 * Подтверждение необратимого действия. Кнопка называет действие словами
 * («Удалить сообщение»), а не «Да» — по правилам копирайта контракта.
 */
export function ConfirmSheet({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
  pending = false,
  confirmDisabled = false,
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  /** Подтвердить пока нельзя (например, ник ещё не набран), а отменить — можно. */
  confirmDisabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="quiet" size="lg" full onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button
            type="button"
            variant={danger ? "danger" : "primary"}
            size="lg"
            full
            onClick={onConfirm}
            disabled={pending || confirmDisabled}
            aria-busy={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-2 text-[15px] leading-[1.45] text-ink-soft">{children}</div>
    </Sheet>
  );
}
