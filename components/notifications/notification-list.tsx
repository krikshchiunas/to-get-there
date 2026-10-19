"use client";

import { groupHeading, listLead, listStamp } from "@/components/ui/list-row";
import Link from "next/link";
import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FollowButton } from "@/components/profile/follow-button";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TimeFromNow } from "@/components/ui/time-from-now";
import { pluralRu } from "@/lib/format";
import type { IconName, Notification, UserView } from "@/lib/types";

/**
 * Уведомления.
 *
 * Строка уведомления — та же строка, что и в ленте: аватар слева, одно
 * предложение справа от него, время под ним, разделитель снизу. Ни рамки, ни
 * второго фона: в Threads и Instagram уведомление выглядит ровно так, потому
 * что их читают пачкой и каждая рамка замедляет чтение.
 *
 * Отметка о прочтении живёт в локальном состоянии, поэтому заголовок экрана
 * и список делят один провайдер: кнопка «Прочитать все» стоит в `PageHeader`,
 * а строки — ниже.
 *
 * Группы считаются по тому, что пришло с сервера, а не по текущему состоянию,
 * иначе строка перепрыгивала бы из «Новые» в «Раньше» под пальцем.
 */

export interface NotificationItem {
  notification: Notification;
  /** Разрешён на сервере из `payload.actor_id`. Null, когда актора нет. */
  actor: UserView | null;
}

interface Store {
  items: NotificationItem[];
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  unreadCount: number;
}

const StoreContext = createContext<Store | null>(null);

function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("NotificationsProvider нужен выше в дереве.");
  return store;
}

export function NotificationsProvider({
  items,
  children,
}: {
  items: NotificationItem[];
  children: ReactNode;
}) {
  const [readIds, setReadIds] = useState<string[]>(() =>
    items.filter((item) => item.notification.is_read).map((item) => item.notification.id),
  );

  const store = useMemo<Store>(() => {
    const read = new Set(readIds);

    return {
      items,
      isRead: (id) => read.has(id),
      markRead: (id) => {
        // TODO(supabase): update notifications set is_read = true where id = $1 and user_id = auth.uid()
        setReadIds((current) => (current.includes(id) ? current : [...current, id]));
      },
      markAllRead: () => {
        // TODO(supabase): update notifications set is_read = true where user_id = auth.uid() and is_read = false
        setReadIds(items.map((item) => item.notification.id));
      },
      unreadCount: items.filter((item) => !read.has(item.notification.id)).length,
    };
  }, [items, readIds]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** Действие в заголовке экрана. Гаснет, когда непрочитанных нет. */
export function MarkAllReadButton() {
  const { markAllRead, unreadCount } = useStore();

  return (
    <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
      Прочитать все
    </Button>
  );
}

export function NotificationFeed() {
  const { items } = useStore();
  const fresh = items.filter((item) => !item.notification.is_read);
  const earlier = items.filter((item) => item.notification.is_read);

  return (
    <div className="pb-8">
      {fresh.length > 0 ? <Group title="Новые" items={fresh} /> : null}
      {earlier.length > 0 ? <Group title="Раньше" items={earlier} /> : null}
    </div>
  );
}

function Group({ title, items }: { title: string; items: NotificationItem[] }) {
  return (
    <section>
      <h2 className={groupHeading}>{title}</h2>
      <ul className="u-feed">
        {items.map((item) => (
          <Row key={item.notification.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function Row({ item }: { item: NotificationItem }) {
  const { isRead, markRead } = useStore();
  const { notification, actor } = item;
  const unread = !isRead(notification.id);
  const line = describe(notification, actor);

  const body = (
    <>
      <span className="block text-[15px] leading-[1.4]">{line.sentence}</span>
      {line.preview ? (
        <span className="u-clamp-2 mt-0.5 block text-[14px] leading-[1.4] text-ink-soft">
          «{clip(line.preview, 140)}»
        </span>
      ) : null}
    </>
  );

  return (
    <li
      className={[
        "u-feed-divider relative isolate flex items-start gap-3 px-4 py-3.5",
        unread ? "bg-signal-wash" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {actor ? (
        <span className={listLead}><Avatar user={actor} size="md" /></span>
      ) : (
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-soft"
        >
          <Icon name={fallbackIcon(notification.type)} size={18} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {/* Вся строка открывает то, о чём уведомление: ссылка растянута на
            контейнер, а кнопка подписки поднята над ней. */}
        {line.href ? (
          <Link
            href={line.href}
            onClick={() => markRead(notification.id)}
            className="block after:absolute after:inset-0"
          >
            {body}
          </Link>
        ) : (
          body
        )}

        <p className={`mt-0.5 ${listStamp}`}>
          <TimeFromNow value={notification.created_at} />
        </p>

        {/* Кнопка подписки идёт под текстом, а не справа: «Подписаться
            взаимно» на 375px оставляет предложению четыре слова в столбик. */}
        {notification.type === "new_follower" && actor ? (
          <div className="relative z-10 mt-2">
            <FollowButton user={actor} size="sm" />
          </div>
        ) : null}
      </div>

      {unread ? (
        <span className="shrink-0 self-center">
          <span aria-hidden className="block size-2 rounded-full bg-signal" />
          <span className="sr-only">Непрочитано</span>
        </span>
      ) : null}
    </li>
  );
}

interface Line {
  sentence: ReactNode;
  /** Null, когда в payload не хватает данных для ссылки. */
  href: string | null;
  preview?: string;
}

/** Одно русское предложение на тип уведомления — и куда оно ведёт. */
function describe(notification: Notification, actor: UserView | null): Line {
  const { payload } = notification;
  const name = actor?.nickname ?? payload.actor_nickname ?? "Кто-то";
  const title = payload.post_title ?? null;
  const postHref = payload.post_id ? `/post/${payload.post_id}` : null;
  const profileHref = actor ? `/u/${actor.nickname}` : null;
  const idea = title ? <> {quoted(title)}</> : null;

  switch (notification.type) {
    case "new_participant":
      return {
        href: postHref,
        sentence: (
          <>
            <span className="font-medium">{name}</span> теперь участник твоей идеи{idea}
          </>
        ),
      };

    case "new_message":
      return {
        href: postHref,
        preview: payload.message_preview,
        sentence: (
          <>
            <span className="font-medium">{name}</span> в чате{idea}
          </>
        ),
      };

    case "new_follower":
      return {
        href: profileHref,
        sentence: (
          <>
            <span className="font-medium">{name}</span> — твой новый подписчик
          </>
        ),
      };

    case "new_post_from_following":
      return {
        href: postHref,
        sentence: (
          <>
            Новая идея от <span className="font-medium">{name}</span>{title ? ":" : ""}
            {idea}
          </>
        ),
      };

    case "event_reminder": {
      const minutes = payload.minutes_until;
      return {
        href: postHref,
        sentence:
          minutes == null ? (
            <>{title ? quoted(title) : "Идея"} скоро начинается</>
          ) : (
            <>
              {title ? quoted(title) : "Идея"} начинается через {minutes}{" "}
              {pluralRu(minutes, ["минуту", "минуты", "минут"])}
            </>
          ),
      };
    }
  }
}

function quoted(title: string): ReactNode {
  return <span className="font-medium">«{title}»</span>;
}

function fallbackIcon(type: Notification["type"]): IconName {
  return type === "event_reminder" ? "clock" : "bell";
}

/** Превью сообщения обрезается, чтобы строка оставалась строкой. */
function clip(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}
