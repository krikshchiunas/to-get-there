"use client";

import { updatePrivacy } from "@/app/actions/settings";
import { notify } from "@/components/ui/toast";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, RadioRow, Switch } from "@/components/ui/field";
import type { IconName, MessageAudience, PrivacySettings, ProfileAudience, UserView } from "@/lib/types";

/**
 * Приватность.
 *
 * Каждый вариант подписан тем, кто это на самом деле: «друзья» — взаимная
 * подписка, «мой университет» — все из того университета, что стоит в твоём
 * профиле. Без этой строки вариант угадывается неправильно.
 *
 * Варианты — залитые плашки без рамок, секции разделены заголовком и
 * воздухом. Переключатель поиска — обычная строка списка.
 */

interface AudienceOption<T extends string> {
  value: T;
  label: string;
  description: string;
  icon: IconName;
}

const FRIENDS_LINE = "Друзья — вы подписаны друг на друга.";

function profileOptions(shortName: string): AudienceOption<ProfileAudience>[] {
  return [
    {
      value: "everyone",
      label: "Все",
      description: "Любой студент в приложении.",
      icon: "globe",
    },
    {
      value: "university",
      label: "Мой университет",
      description: `Все из ${shortName} — и только они.`,
      icon: "shield",
    },
    {
      value: "friends",
      label: "Только друзья",
      description: FRIENDS_LINE,
      icon: "person",
    },
  ];
}

const messageOptions: AudienceOption<MessageAudience>[] = [
  {
    value: "everyone",
    label: "Все",
    description: "Любой студент может написать тебе первым.",
    icon: "chat",
  },
  {
    value: "friends",
    label: "Только друзья",
    description: FRIENDS_LINE,
    icon: "person",
  },
  {
    value: "nobody",
    label: "Никто",
    description: "Личные сообщения закрыты. Договориться можно в чате идеи.",
    icon: "lock",
  },
];

function toProfileAudience(raw: string): ProfileAudience {
  return raw === "university" || raw === "friends" ? raw : "everyone";
}

function toMessageAudience(raw: string): MessageAudience {
  return raw === "friends" || raw === "nobody" ? raw : "everyone";
}

function same(a: PrivacySettings, b: PrivacySettings): boolean {
  return (
    a.who_can_see_profile === b.who_can_see_profile &&
    a.who_can_see_interests === b.who_can_see_interests &&
    a.who_can_message === b.who_can_message &&
    a.visible_in_search === b.visible_in_search &&
    a.read_receipts === b.read_receipts
  );
}

export function PrivacyForm({ user }: { user: UserView }) {
  const [draft, setDraft] = useState<PrivacySettings>(() => ({ ...user.privacy_settings }));
  const [saved, setSaved] = useState<PrivacySettings>(() => ({ ...user.privacy_settings }));
  const [confirmed, setConfirmed] = useState(false);

  const dirty = !same(draft, saved);
  const shortName = user.university.short_name;
  const audiences = profileOptions(shortName);

  function patch(change: Partial<PrivacySettings>) {
    setDraft((current) => ({ ...current, ...change }));
    setConfirmed(false);
  }

  const [saving, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = { ...draft };
    startTransition(async () => {
      const result = await updatePrivacy(next);
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
        Эти настройки решают, кто видит тебя и кто может тебе написать. Сами идеи видны всем — иначе к ним
        никто не присоединится.
      </p>

      <section className="mt-6 space-y-7 px-4">
        <AudienceGroup
          name="privacy-profile"
          legend="Кто видит твой профиль"
          hint={`Профиль — это описание, факультет, счётчики подписок и твои идеи. Вариант «Мой университет» означает всех, у кого в профиле ${shortName}.`}
          options={audiences}
          value={draft.who_can_see_profile}
          onChange={(raw) => patch({ who_can_see_profile: toProfileAudience(raw) })}
        />

        <AudienceGroup
          name="privacy-interests"
          legend="Кто видит интересы и цели"
          hint="Можно держать профиль открытым, а интересы и цели показывать только друзьям."
          options={audiences}
          value={draft.who_can_see_interests}
          onChange={(raw) => patch({ who_can_see_interests: toProfileAudience(raw) })}
        />

        <AudienceGroup
          name="privacy-messages"
          legend="Кто может тебе написать"
          hint="Про личные сообщения. В чате идеи говорят все, кого туда пустил автор."
          options={messageOptions}
          value={draft.who_can_message}
          onChange={(raw) => patch({ who_can_message: toMessageAudience(raw) })}
        />
      </section>

      <section>
        <h2 className="px-4 pt-7 pb-2 text-[13px] font-medium text-ink-faint">Поиск людей</h2>
        <div className="u-feed">
          <div className="u-feed-divider px-4">
            <Switch
              checked={draft.visible_in_search}
              onChange={(next) => patch({ visible_in_search: next })}
              label="Показывать меня в поиске людей"
              description="Без этого тебя не найдут по нику, факультету или интересам. Идеи, которые ты создаёшь, в поиске остаются."
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="px-4 pt-7 pb-2 text-[13px] font-medium text-ink-faint">Личные сообщения</h2>
        <div className="u-feed">
          <div className="u-feed-divider px-4">
            <Switch
              checked={draft.read_receipts}
              onChange={(next) => patch({ read_receipts: next })}
              label="Отметка «Прочитано»"
              description="Собеседник видит, что ты прочитал его сообщения. Работает взаимно: выключишь — и сам не будешь видеть, прочитали ли тебя."
            />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mb-24 mt-7 border-t border-line bg-paper/95 px-4 backdrop-blur-sm md:-mb-10">
        <div className="u-safe-b pt-3">
          <div className="pb-[4.25rem] md:pb-3">
            {confirmed && !dirty ? (
              <p role="status" className="pb-2 text-center text-[12px] text-ink-soft">
                Сохранено.
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

function AudienceGroup<T extends string>({
  name,
  legend,
  hint,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  hint: string;
  options: AudienceOption<T>[];
  value: T;
  onChange: (raw: string) => void;
}) {
  return (
    <Field label={legend} required hint={hint}>
      <div role="radiogroup" aria-label={legend} className="space-y-2">
        {options.map((option) => (
          <RadioRow
            key={option.value}
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={onChange}
            label={option.label}
            description={option.description}
            icon={option.icon}
          />
        ))}
      </div>
    </Field>
  );
}
