"use client";

import { updateNotificationSettings } from "@/app/actions/settings";
import { notify } from "@/components/ui/toast";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/field";
import type { NotificationSettings, UserView } from "@/lib/types";

/**
 * Уведомления.
 *
 * Семь переключателей, все включены по умолчанию. Подпись каждого описывает
 * событие словами пользователя, а не названием ключа в базе.
 *
 * Группы разделены заголовком и воздухом, а не плашкой: четыре залитых блока
 * на одном экране снова читались бы как дашборд.
 */

type SettingKey = keyof NotificationSettings;

interface Row {
  key: SettingKey;
  label: string;
  description: string;
}

interface Group {
  title: string;
  description?: string;
  rows: Row[];
}

const groups: Group[] = [
  {
    title: "Твои идеи",
    description: "Про идеи, которые ты создал, и чаты, в которых ты участвуешь.",
    rows: [
      {
        key: "new_participant",
        label: "Кто-то присоединился",
        description: "Когда человек заходит в чат твоей идеи.",
      },
      {
        key: "new_message_in_post",
        label: "Новое сообщение в чате идеи",
        description: "По всем чатам идей, в которых ты участвуешь.",
      },
    ],
  },
  {
    title: "Сообщения",
    rows: [
      {
        key: "new_message_direct",
        label: "Личное сообщение",
        description: "Когда пишут тебе напрямую, а не в чат идеи.",
      },
    ],
  },
  {
    title: "Люди",
    rows: [
      {
        key: "new_follower",
        label: "Новый подписчик",
        description: "Когда на тебя подписались. Подпишись взаимно — и вы друзья.",
      },
      {
        key: "new_post_from_following",
        label: "Новая идея от тех, на кого ты подписан",
        description: "Та же идея появится в ленте «Подписки».",
      },
    ],
  },
  {
    title: "Напоминания",
    description: "Приходят по идеям, в чат которых ты зашёл.",
    rows: [
      {
        key: "event_reminder_1h",
        label: "За час до начала",
        description: "Чтобы успеть доехать.",
      },
      {
        key: "event_reminder_30m",
        label: "За 30 минут до начала",
        description: "Последнее напоминание перед выходом.",
      },
    ],
  },
];

function same(a: NotificationSettings, b: NotificationSettings): boolean {
  return groups.every((group) => group.rows.every((row) => a[row.key] === b[row.key]));
}

export function NotificationForm({ user }: { user: UserView }) {
  const [draft, setDraft] = useState<NotificationSettings>(() => ({
    ...user.notification_settings,
  }));
  const [saved, setSaved] = useState<NotificationSettings>(() => ({
    ...user.notification_settings,
  }));
  const [confirmed, setConfirmed] = useState(false);

  const dirty = !same(draft, saved);
  const offCount = groups.flatMap((group) => group.rows).filter((row) => !draft[row.key]).length;

  function toggle(key: SettingKey, next: boolean) {
    setDraft((current) => {
      const updated: NotificationSettings = { ...current };
      updated[key] = next;
      return updated;
    });
    setConfirmed(false);
  }

  const [saving, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = { ...draft };
    startTransition(async () => {
      const result = await updateNotificationSettings(next);
      if (!result.ok) {
        notify(result.error);
        return;
      }
      setSaved(next);
      setConfirmed(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="pt-5">
      <p className="px-4 text-[14px] leading-[1.4] text-ink-soft">
        Всё включено с самого начала. Выключай то, о чём знать не хочешь — остальное останется.
      </p>

      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="px-4 pt-6 pb-2 text-[13px] font-medium text-ink-faint">{group.title}</h2>
          {group.description ? (
            <p className="px-4 pb-2 text-[14px] leading-[1.4] text-ink-soft">{group.description}</p>
          ) : null}

          <div className="u-feed">
            {group.rows.map((row) => (
              <div key={row.key} className="u-feed-divider px-4">
                <Switch
                  checked={draft[row.key]}
                  onChange={(next) => toggle(row.key, next)}
                  label={row.label}
                  description={row.description}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="mt-7 px-4 text-[14px] leading-[1.4] text-ink-soft">
        Пуши и письма подключим вместе с бэкендом. Пока это список того, о чём приложение будет сообщать, а
        сами уведомления в приложении приходят из тестовых данных.
      </p>

      <div className="sticky bottom-0 z-10 -mb-24 mt-7 border-t border-line bg-paper/95 px-4 backdrop-blur-sm md:-mb-10">
        <div className="u-safe-b pt-3">
          <div className="pb-[4.25rem] md:pb-3">
            {confirmed && !dirty ? (
              <p role="status" className="pb-2 text-center text-[12px] text-ink-soft">
                {offCount === 0 ? "Сохранено. Все уведомления включены." : "Сохранено."}
              </p>
            ) : null}

            <Button type="submit" size="lg" full disabled={!dirty || saving}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
