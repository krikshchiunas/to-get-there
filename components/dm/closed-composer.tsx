"use client";

import Link from "next/link";
import { useTransition } from "react";
import { setBlocked } from "@/app/actions/safety";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/components/ui/toast";
import type { UserView } from "@/lib/types";

/**
 * A composer that cannot work is worse than none: the recipient's setting is
 * spelled out instead, and the profile stays one tap away. Если писать нельзя
 * из-за своей же блокировки — тут же и разблокировать.
 */
export function ClosedComposer({ partner, viewerId }: { partner: UserView; viewerId: string }) {
  const notice = noticeFor(partner, viewerId);
  const [pending, startTransition] = useTransition();

  function unblock() {
    startTransition(async () => {
      const result = await setBlocked(partner.id, false);
      if (!result.ok) notify(result.error);
    });
  }

  return (
    <div className="px-4 py-4">
      <div className="rounded-field bg-sunken p-4">
        <p className="flex items-center gap-2 text-[15px]">
          <Icon name={partner.viewer_blocked ? "block" : "lock"} size={17} className="shrink-0 text-ink-soft" />
          {notice.title}
        </p>
        <p className="mt-1 text-[14px] leading-[1.4] text-ink-soft">{notice.body}</p>
        {partner.viewer_blocked ? (
          <Button type="button" variant="quiet" size="md" className="mt-3" onClick={unblock} disabled={pending}>
            Разблокировать
          </Button>
        ) : (
          <Link
            href={`/u/${partner.nickname}`}
            className="mt-1.5 -mx-1 inline-block px-1 py-2 text-[15px] text-signal"
          >
            Открыть профиль
          </Link>
        )}
      </div>
    </div>
  );
}

function noticeFor(partner: UserView, viewerId: string): { title: string; body: string } {
  if (partner.id === viewerId) {
    return {
      title: "Это твой профиль",
      body: "Себе написать нельзя.",
    };
  }

  if (partner.viewer_blocked) {
    return {
      title: `Ты заблокировал ${partner.nickname}`,
      body: "Пока блокировка стоит, вы не можете писать друг другу. История переписки остаётся у тебя.",
    };
  }

  if (partner.privacy_settings.who_can_message === "friends") {
    return {
      title: "Писать могут только друзья",
      body: `${partner.nickname} принимает сообщения только от друзей. Друзьями вы станете, когда подпишетесь друг на друга.`,
    };
  }

  return {
    title: "Сообщения выключены",
    body: `${partner.nickname} не принимает сообщения. Написать можно в чате общей идеи.`,
  };
}
