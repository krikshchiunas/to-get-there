"use client";

import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { ChipButton } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";
import { pluralRu } from "@/lib/format";
import { activeFilterCount, dateLabel, placeLabel, relaxHint, timeLabel } from "@/lib/search-draft";
import { filterPosts } from "@/lib/search-filter";
import { usePlace } from "@/lib/use-place";
import { emptyFilters, type Category, type PostView, type SearchFilters, type UserView } from "@/lib/types";
import { FilterSheet } from "./filter-sheet";
import { OtherCategoriesSheet } from "./other-categories-sheet";
import { PeopleResults } from "./people-results";
import { ResultCard } from "./result-card";
import { usePeopleSearch } from "./use-people-search";

/**
 * Поиск идей и людей.
 *
 * Фильтры живут здесь одним объектом `SearchFilters` — ряд чипов, лист
 * «Фильтры» и строка-сводка читают и пишут в одно место. Какая вкладка
 * открыта, решает адрес (`Segmented` — ссылки); всё введённое и выбранное
 * остаётся в состоянии, поэтому смена вкладки не теряет запрос и фильтры.
 */

export type SearchTab = "ideas" | "people";

const QUERY_ID = "search-query";

export function SearchScreen({
  nowIso,
  tab,
  viewer,
  posts,
  categories,
  cities,
}: {
  nowIso: string;
  tab: SearchTab;
  /** Кто смотрит: нужен, чтобы не показывать себя в результатах. */
  viewer: UserView;
  /** Идеи, которые сейчас в ленте. Фильтруются здесь же, без похода на сервер. */
  posts: PostView[];
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
  const {
    place: originPlace,
    locate,
    resetToCampus,
    locating,
    error: locateError,
  } = usePlace(viewer.university);
  const origin = useMemo(
    () => ({ lat: originPlace.lat, lng: originPlace.lng }),
    [originPlace.lat, originPlace.lng],
  );
  const ideas = useMemo(() => filterPosts(posts, filters, now, origin), [posts, filters, now, origin]);
  const { people, searching: peopleLoading } = usePeopleSearch(filters.query, tab === "people");

  const sheetFilterCount = activeFilterCount(filters);
  const selectedCategories = filters.category_ids
    .map((id) => getCategory(id))
    .filter((category): category is Category => category !== undefined);
  const selectedOther = otherCategories.filter((category) => filters.category_ids.includes(category.id));

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
  const summary = [categoryLabel, date, timeLabel(filters), place].filter(
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

            <ChipButton icon="settings" active={sheetFilterCount > 0} onClick={() => setFilterOpen(true)}>
              Фильтры
              {sheetFilterCount > 0 ? <span className="u-tnum">{sheetFilterCount}</span> : null}
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
              <Button variant="ghost" size="sm" onClick={resetFilters} className="-mr-2 shrink-0">
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
        <PeopleResults
          query={filters.query}
          people={people}
          loading={peopleLoading}
          hasFilters={hasFilters}
          viewerId={viewer.id}
        />
      )}

      <OtherCategoriesSheet
        open={otherOpen}
        onClose={() => setOtherOpen(false)}
        categories={otherCategories}
        selected={filters.category_ids}
        onToggle={toggleCategory}
      />

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
