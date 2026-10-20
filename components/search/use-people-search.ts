"use client";

import { useEffect, useRef, useState } from "react";
import { findPeople } from "@/app/actions/search";
import type { UserView } from "@/lib/types";

/** Пауза после последней буквы: запрос уходит, когда человек перестал печатать. */
const DEBOUNCE_MS = 250;

/**
 * Люди по мере ввода. Запросы идут на сервер с паузой, а ответ на устаревший
 * запрос отбрасывается — иначе медленный ответ на «ми» мог бы прийти после
 * быстрого на «мира» и подменить результат.
 */
export function usePeopleSearch(query: string, active: boolean) {
  const [people, setPeople] = useState<UserView[]>([]);
  const [searching, setSearching] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const needle = query.trim();
    if (!active || needle.length < 2) {
      latest.current += 1;
      setPeople([]);
      setSearching(false);
      return;
    }

    const request = ++latest.current;
    setSearching(true);
    const timer = window.setTimeout(() => {
      findPeople(needle)
        .then((found) => {
          if (request === latest.current) setPeople(found);
        })
        .catch(() => {
          if (request === latest.current) setPeople([]);
        })
        .finally(() => {
          if (request === latest.current) setSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, active]);

  return { people, searching };
}
