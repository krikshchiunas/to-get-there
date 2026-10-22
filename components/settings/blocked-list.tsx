"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setBlocked } from "@/app/actions/safety";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { listLead, listRow } from "@/components/ui/list-row";
import { notify } from "@/components/ui/toast";
import type { UserView } from "@/lib/types";

/** Заблокированные — строки как везде, справа «Разблокировать». */
export function BlockedList({ users: initial }: { users: UserView[] }) {
  const [users, setUsers] = useState(initial);
  const [, startTransition] = useTransition();

  function unblock(user: UserView) {
    const before = users;
    setUsers((previous) => previous.filter((item) => item.id !== user.id));
    startTransition(async () => {
      const result = await setBlocked(user.id, false);
      if (!result.ok) {
        setUsers(before);
        notify(result.error);
        return;
      }
      notify(`${user.nickname} разблокирован.`, "info");
    });
  }

  if (users.length === 0) {
    return (
      <EmptyState
        icon="block"
        title="Никого не заблокировано"
        body="Заблокировать человека можно в его профиле: «⋯», затем «Заблокировать»."
      />
    );
  }

  return (
    <ul className="u-feed">
      {users.map((user) => (
        <li key={user.id} className={`${listRow} items-center`}>
          <span className={listLead}>
            <Avatar user={user} size="md" />
          </span>
          <div className="min-w-0 flex-1">
            <Link
              href={`/u/${user.nickname}`}
              className="block truncate text-[15px] font-medium after:absolute after:inset-0"
            >
              {user.nickname}
            </Link>
            {user.university ? (
              <p className="truncate text-[14px] text-ink-soft">{user.university.short_name}</p>
            ) : null}
          </div>
          <span className="relative z-10 shrink-0">
            <Button type="button" variant="quiet" size="sm" onClick={() => unblock(user)}>
              Разблокировать
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}
