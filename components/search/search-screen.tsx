"use client";

import { useMemo, useState } from "react";
import { UserRow } from "@/components/profile/user-row";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { ChipButton } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { formatDayLabel, formatMinutesOfDay, formatRadius, pluralRu } from "@/lib/format";
import { filterPosts, filterUsers } from "@/lib/search-filter";
import { usePlace } from "@/lib/use-place";
import {
  emptyFilters,
  type Category,
  type PostView,
  type SearchFilters,
  type UserView,
} from "@/lib/types";
import { activeFilterCount, FilterSheet } from "./filter-sheet";
import { ResultCard } from "./result-card";

/**
 * Search over ideas and people.
 *
 * The filters live here as one `SearchFilters` object — the same shape the
 * mock layer takes today and the Supabase query will take later — so the chip
 * row, the sheet and the summary line all read from and write to one place.
 * Which of the two tabs is open comes from the URL, because `Segmented` is a
 * link control; everything the person types or picks stays in state, so
 * switching tabs keeps the query and the filters.
 */

export type SearchTab = "ideas" | "people";

const QUERY_ID = "search-query";

/** "с 24 окт.", "Сегодня", "Сегодня – Сб, 24 окт." */
function dateLabel(filters: SearchFilters, now: Date): string | null {
  const label = (iso: string) => formatDayLabel(`${iso}T12:00:00`, now);
  const { date_from: from, date_to: to } = filters;

  if (from && to) return from === to ? label(from) : `${label(from)} – ${label(to)}`;
  if (from) return `с ${label(from)}`;
  if (to) return `по ${label(to)}`;
  return null;
}

function placeLabel(filters: SearchFilters): string | null {
  switch (filters.geo_mode) {
    case "radius":
      return filters.geo_radius_m === null
        ? null
        : `${formatRadius(filters.geo_radius_m)} вокруг меня`;
    case "city":
      return filters.geo_city;
    case "area":
      return "Область на карте";
    default:
      return null;
  }
}

/** Which filter to loosen first when nothing came back. */
function relaxHint(filters: SearchFilters): string {
  if (filters.date_from !== null || filters.date_to !== null) {
    return "Самое узкое здесь — дата. Возьми диапазон пошире или сними её совсем.";
  }
  if (filters.time_window !== null) {
    const { from_minutes: from, to_minutes: to } = filters.time_window;
    return `В окне с ${formatMinutesOfDay(from)} до ${formatMinutesOfDay(to)} ничего нет. Убери время суток или раздвинь окно.`;
  }
  if (filters.geo_mode === "radius" && filters.geo_radius_m !== null) {
    return `Внутри ${formatRadius(filters.geo_radius_m)} пусто. Возьми радиус побольше или укажи город.`;
  }
  if (filters.geo_mode === "city" && filters.geo_city !== null) {
    return `В ${filters.geo_city} сейчас ничего нет. Попробуй другой город или сними фильтр места.`;
  }
  if (filters.category_ids.length > 0) {
    return "Сними часть категорий — так в результаты попадёт больше идей.";
  }
  return "Поиск смотрит название, описание, место, категорию и ник автора. Попробуй другое слово.";
}

export function SearchScreen({
  nowIso,
  tab,
  viewer,
  posts,
  people: searchablePeople,
  categories,
  cities,
}: {
  nowIso: string;
  tab: SearchTab;
  /** Кто смотрит: нужен, чтобы не показывать себя в результатах. */
  viewer: UserView;
  /** Идеи, которые сейчас в ленте. Фильтруются здесь же, без похода на сервер. */
  posts: PostView[];
  /** Люди, видимые в поиске. */
  people: UserView[];
  categories: Category[];
  cities: string[];
}) {
  const mainCategories = useMemo(() => categories.filter((c) => c.is_main), [categories]);
  const otherCategories = useMemo(() => categories.filter((c) => !c.is_main), [categories]);
  const getCategory = (id: string) => categories.find((c) => c.id === id);
  // The clock is read once per request on the server and passed in, so the
  // urgency colours and day labels are the same before and after hydration.
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [otherOpen, setOtherOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Набор приходит с сервера один раз, а сужается здесь — так ввод в поле
  // отзывается мгновенно, без похода на сервер на каждую букву.
  const { place: originPlace, locate, resetToCampus, locating, error: locateError } = usePlace(viewer.university);
  const origin = useMemo(() => ({ lat: originPlace.lat, lng: originPlace.lng }), [originPlace.lat, originPlace.lng]);
  const ideas = useMemo(() => filterPosts(posts, filters, now, origin), [posts, filters, now, origin]);
  const people = useMemo(
    () => filterUsers(searchablePeople, filters.query, viewer.id),
    [searchablePeople, filters.query, viewer.id],
  );

  const sheetFilterCount = activeFilterCount(filters);
  const selectedCategories = filters.category_ids
    .map((id) => getCategory(id))
    .filter((category): category is Category => category !== undefined);
  const selectedOther = otherCategories.filter((category) =>
    filters.category_ids.includes(category.id),
  );

  const hasQuery = filters.query.trim().length > 0;
  const hasFilters = selectedCategories.length > 0 || sheetFilterCount > 0;
  const date = dateLabel(filters, now);
  const place = placeLabel(filters);

  /** Активные фильтры одной строкой: «Спорт · Сегодня · 18:00–23:00 · Берлин». */
  const categoryLabel =
    selectedCategories.length === 0
      ? null
      : selectedCategories.length === 1
        ? selectedCategories[0].name
        : `${selectedCategories.length} ${pluralRu(selectedCategories.length, [
            "категория",
            "категории",
            "категорий",
          ])}`;
  const timeLabel = filters.time_window
    ? `${formatMinutesOfDay(filters.time_window.from_minutes)}–${formatMinutesOfDay(
        filters.time_window.to_minutes,
      )}`
    : null;
  const summary = [categoryLabel, date, timeLabel, place].filter(
    (part): part is string => part !== null,
  );

  function toggleCategory(id: string) {
    setFilters((current) => ({
      ...current,
      category_ids: current.category_ids.includes(id)
        ? current.category_ids.filter((value) => value !== id)
        : [...current.category_ids, id],
    }));
  }

  /** Clears everything picked, keeps what was typed. */
  function resetFilters() {
    setFilters({ ...emptyFilters, query: filters.query });
  }

  return (
    <>
      {/* Поле поиска — пилюля на заливке, без рамки: одна линия на экране
          вместо двух. Иконка слева, крестик очистки справа, высота 44px. */}
      <div className="px-4 pt-3 pb-3">
        <label htmlFor={QUERY_ID} className="sr-only">
          Поиск идей и людей
        </label>
        <div className="relative">
          <Icon
            name="search"
            size={18}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint"
          />
          <input
            id={QUERY_ID}
            type="search"
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            placeholder="Идея, место или человек"
            autoComplete="off"
            enterKeyHint="search"
            className="h-11 w-full appearance-none rounded-pill bg-sunken pr-11 pl-11 text-[15px] outline-none transition-shadow focus:ring-2 focus:ring-signal/35 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {filters.query ? (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => setFilters({ ...filters, query: "" })}
              className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-ink"
            >
              <Icon name="close" size={16} />
            </button>
          ) : null}
        </div>
      </div>

      <Segmented
        ariaLabel="Что искать"
        active={tab}
        items={[
          { value: "ideas", label: "Идеи", href: "/search" },
          { value: "people", label: "Люди", href: "/search?tab=people" },
        ]}
      />

      {/* Ряд категорий лежит под вкладками без своей линии: вкладки её уже
          дали, вторая сделала бы из полосы фильтров отдельную панель. */}
      {tab === "ideas" ? (
        <div className="u-scroll-x">
          <div className="flex w-max gap-2 px-4 pt-3 pb-2">
            {mainCategories.map((category) => (
              <ChipButton
                key={category.id}
                icon={category.icon}
                active={filters.category_ids.includes(category.id)}
                onClick={() => toggleCategory(category.id)}
              >
                {category.name}
              </ChipButton>
            ))}

            {selectedOther.map((category) => (
              <ChipButton
                key={category.id}
                icon={category.icon}
                active
                onClick={() => toggleCategory(category.id)}
              >
                {category.name}
              </ChipButton>
            ))}

            <ChipButton icon="more" onClick={() => setOtherOpen(true)}>
              Другое
            </ChipButton>

            <ChipButton
              icon="settings"
              active={sheetFilterCount > 0}
              onClick={() => setFilterOpen(true)}
            >
              Фильтры
              {sheetFilterCount > 0 ? (
                <span className="u-tnum">{sheetFilterCount}</span>
              ) : null}
            </ChipButton>
          </div>
        </div>
      ) : null}

      {tab === "ideas" ? (
        <>
          {/* Что сейчас сужает поиск — это текст, а не ряд плашек: плашки
              повторяли выбор, который уже виден на чипах выше. */}
          {hasFilters ? (
            <div className="flex items-start gap-3 px-4 pt-3">
              <p className="u-tnum min-w-0 flex-1 text-[14px] leading-[1.4] text-ink-soft">
                {summary.join(" · ")}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="-mr-2 shrink-0"
              >
                Сбросить
              </Button>
            </div>
          ) : null}

          {!hasQuery && !hasFilters ? (
            <EmptyState
              icon="search"
              title="Что ищешь?"
              body="Напиши название идеи, место или ник автора. Или возьми категорию и сузь поиск по дате, времени суток и городу."
              action={
                <ButtonLink href="/" variant="quiet">
                  Смотреть идеи
                </ButtonLink>
              }
            />
          ) : ideas.length === 0 ? (
            <EmptyState
              icon="sparkle"
              title="Идей не нашлось"
              body={relaxHint(filters)}
              action={
                hasFilters ? (
                  <Button variant="quiet" onClick={resetFilters}>
                    Сбросить фильтры
                  </Button>
                ) : (
                  <ButtonLink href="/create">Создать идею</ButtonLink>
                )
              }
            />
          ) : (
            <>
              <p aria-live="polite" className="px-4 pt-3 pb-1.5 text-[13px] text-ink-faint">
                <span className="u-tnum">{ideas.length}</span>{" "}
                {pluralRu(ideas.length, ["идея", "идеи", "идей"])}
              </p>
              <ul className="u-feed">
                {ideas.map((post) => (
                  <ResultCard key={post.id} post={post} now={now} />
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <>
          {hasFilters ? (
            <p className="px-4 pt-3 text-[13px] leading-[1.4] text-ink-soft">
              Категории и фильтры работают для идей. Людей находим по слову из ника, факультета
              или интересов.
            </p>
          ) : null}

          {!hasQuery ? (
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
          ) : people.length === 0 ? (
            <EmptyState
              icon="person"
              title="Никого не нашлось"
              body="Проверь ник по буквам или попробуй слово попроще. Часть студентов скрыла себя из поиска — их так не найти, зато они видны под своими идеями."
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
                    <UserRow user={user} viewerId={viewer.id} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <Sheet
        open={otherOpen}
        onClose={() => setOtherOpen(false)}
        title="Другие категории"
        footer={
          <Button full size="lg" onClick={() => setOtherOpen(false)}>
            Закрыть
          </Button>
        }
      >
        <ul className="space-y-0.5">
          {otherCategories.map((category) => {
            const selected = filters.category_ids.includes(category.id);
            return (
              <li key={category.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleCategory(category.id)}
                  className={[
                    "flex min-h-11 w-full items-center gap-3 rounded-field px-2.5 py-2 text-left text-[15px] transition-colors",
                    selected ? "text-signal" : "text-ink hover:bg-sunken",
                  ].join(" ")}
                >
                  <Icon
                    name={category.icon}
                    size={18}
                    className={selected ? "shrink-0" : "shrink-0 text-ink-soft"}
                  />
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  {selected ? <Icon name="check" size={18} className="shrink-0" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>

      <FilterSheet
        cities={cities}
        place={originPlace}
        onLocate={locate}
        onResetToCampus={resetToCampus}
        locating={locating}
        locateError={locateError}
        open={filterOpen}
        filters={filters}
        onClose={() => setFilterOpen(false)}
        onApply={(next) => {
          // Фильтры сужают уже загруженный набор (filterPosts), без похода на
          // сервер. Когда идей станет столько, что набор не поместится в одну
          // загрузку, источником станет searchPosts из lib/data/search.ts —
          // он уже фильтрует в базе.
          setFilters(next);
          setFilterOpen(false);
        }}
      />
    </>
  );
}
