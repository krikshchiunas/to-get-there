"use client";

import { useState, useTransition } from "react";
import { setBlocked } from "@/app/actions/safety";
import { ActionSheet, ConfirmSheet } from "@/components/ui/action-sheet";
import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/components/ui/toast";
import { ReportSheet } from "@/components/safety/report-sheet";
import type { UserView } from "@/lib/types";

type Open = "menu" | "block" | "report" | null;

/**
 * «⋯» в шапке чужого профиля: заблокировать или разблокировать,
 * пожаловаться. Блокировка — через подтверждение, где сказано, что именно
 * произойдёт: так делают Instagram и Threads, чтобы её не ставили случайно.
 */
export function ProfileMenu({ user }: { user: UserView }) {
  const [open, setOpen] = useState<Open>(null);
  const [pending, startTransition] = useTransition();

  function toggleBlock(next: boolean) {
    startTransition(async () => {
      const result = await setBlocked(user.id, next);
      setOpen(null);
      if (!result.ok) {
        notify(result.error);
        return;
      }
      notify(next ? `${user.nickname} заблокирован.` : `${user.nickname} разблокирован.`, "info");
    });
  }

  return (
    <>
      <IconButton
        type="button"
        label={`Ещё о ${user.nickname}`}
        aria-haspopup="dialog"
        aria-expanded={open === "menu"}
        onClick={() => setOpen("menu")}
      >
        <Icon name="more" size={19} />
      </IconButton>

      <ActionSheet
        open={open === "menu"}
        onClose={() => setOpen(null)}
        title={user.nickname}
        actions={[
          user.viewer_blocked
            ? { label: "Разблокировать", icon: "block", onSelect: () => toggleBlock(false) }
            : { label: "Заблокировать", icon: "block", danger: true, onSelect: () => setOpen("block") },
          { label: "Пожаловаться", icon: "flag", danger: true, onSelect: () => setOpen("report") },
        ]}
      />

      <ConfirmSheet
        open={open === "block"}
        onClose={() => setOpen(null)}
        title={`Заблокировать ${user.nickname}?`}
        confirmLabel="Заблокировать"
        onConfirm={() => toggleBlock(true)}
        pending={pending}
      >
        <ul className="list-disc space-y-1.5 pl-5">
          <li>{user.nickname} не увидит твой профиль, идеи и сообщения в общих чатах.</li>
          <li>Вы не сможете писать друг другу, подписываться и вступать в идеи друг друга.</li>
          <li>Взаимные подписки снимутся.</li>
          <li>Уведомления от {user.nickname} больше не придут.</li>
        </ul>
        <p>{user.nickname} не узнает о блокировке. Снять её можно в любой момент.</p>
      </ConfirmSheet>

      {open === "report" ? (
        <ReportSheet
          open
          onClose={() => setOpen(null)}
          targetType="user"
          targetId={user.id}
          subject={user.nickname}
        />
      ) : null}
    </>
  );
}

/** Плашка на профиле заблокированного: что это значит и как снять. */
export function BlockedNotice({ user }: { user: UserView }) {
  const [pending, startTransition] = useTransition();

  function unblock() {
    startTransition(async () => {
      const result = await setBlocked(user.id, false);
      if (!result.ok) notify(result.error);
    });
  }

  return (
    <div className="mt-4 rounded-field bg-sunken p-4">
      <p className="flex items-center gap-2 text-[15px]">
        <Icon name="block" size={17} className="shrink-0 text-ink-soft" />
        Ты заблокировал {user.nickname}
      </p>
      <p className="mt-1 text-[14px] leading-[1.4] text-ink-soft">
        Вы не видите идеи друг друга и не можете писать друг другу.
      </p>
      <Button type="button" variant="quiet" size="md" className="mt-3" onClick={unblock} disabled={pending}>
        Разблокировать
      </Button>
    </div>
  );
}
