"use client";

import { UserRow } from "@/components/profile/user-row";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { pluralRu } from "@/lib/format";
import type { UserView } from "@/lib/types";

/** Вкладка «Люди»: подсказки до ввода, «ищем…», пусто или список. */
export function PeopleResults({
  query,
  people,
  loading,
  hasFilters,
  viewerId,
}: {
  query: string;
  people: UserView[];
  loading: boolean;
  /** Выбраны категории или фильтры — они к людям не относятся, и это стоит сказать. */
  hasFilters: boolean;
  viewerId: string;
}) {
  const typed = query.trim();

  return (
    <>
      {hasFilters ? (
        <p className="px-4 pt-3 text-[13px] leading-[1.4] text-ink-soft">
          Категории и фильтры работают для идей. Людей находим по слову из ника, факультета или интересов.
        </p>
      ) : null}

      {!typed ? (
        <EmptyState
          icon="person"
          title="Кого ищешь?"
          body="Напиши ник, факультет или интерес — например «статистика» или «велосипед». Кто спрятался из поиска в настройках, здесь не появится."
          action={
            <ButtonLink href="/search" variant="quiet">
              Искать идеи
            </ButtonLink>
          }
        />
      ) : typed.length < 2 ? (
        <p className="px-4 pt-4 text-[14px] text-ink-soft">Набери хотя бы две буквы.</p>
      ) : loading && people.length === 0 ? (
        <p role="status" className="px-4 pt-4 text-[14px] text-ink-soft">
          Ищем…
        </p>
      ) : people.length === 0 ? (
        <EmptyState
          icon="person"
          title="Никого не нашлось"
          body="Проверь ник по буквам или попробуй слово попроще. Часть студентов скрыла себя из поиска — их так не найти, зато они видны под своими идеями. Интересы, которые человек показывает только друзьям, поиск тоже не видит."
        />
      ) : (
        <>
          <p aria-live="polite" className="px-4 pt-3 pb-1.5 text-[13px] text-ink-faint">
            <span className="u-tnum">{people.length}</span>{" "}
            {pluralRu(people.length, ["человек", "человека", "человек"])}
          </p>
          <ul className="u-feed">
            {people.map((user) => (
              <li key={user.id}>
                <UserRow user={user} viewerId={viewerId} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
