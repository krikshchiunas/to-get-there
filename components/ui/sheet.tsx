"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Icon } from "./icon";

/**
 * Bottom sheet built on <dialog>, so focus trapping, Escape and the
 * backdrop come from the platform. Rises from the bottom on mobile and
 * centres on wider screens.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clicks land on the dialog element itself only outside the panel.
        if (event.target === ref.current) onClose();
      }}
      className="m-0 max-h-none max-w-none bg-transparent p-0 backdrop:bg-transparent"
      style={{ width: "100vw", height: "100dvh" }}
      aria-label={title}
    >
      <div className="flex h-full w-full items-end justify-center sm:items-center">
        <div className="u-rise u-safe-b w-full max-w-[34rem] rounded-t-2xl border border-line bg-paper sm:rounded-2xl">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="-mr-1.5 flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-sunken"
            >
              <Icon name="close" size={18} />
            </button>
          </header>

          <div className="max-h-[70dvh] overflow-y-auto px-4 py-4">{children}</div>

          {footer ? <footer className="border-t border-line px-4 py-3">{footer}</footer> : null}
        </div>
      </div>
    </dialog>
  );
}
