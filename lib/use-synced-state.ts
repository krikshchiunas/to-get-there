"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Локальное состояние, которое догоняет сервер.
 *
 * Экран держит данные в useState, чтобы менять их оптимистично. Но когда
 * сервер присылает свежую версию (router.refresh по событию realtime или
 * revalidatePath после действия), useState её проигнорировал бы — начальное
 * значение читается один раз. Здесь новая версия с сервера заменяет
 * локальную, а `merge` решает, что из локального сохранить (например,
 * сообщения, которые ещё летят на сервер).
 *
 * Сравнение по ссылке: после refresh пропсы — новые объекты, а при обычном
 * перерендере родителя — те же самые, и локальные правки не теряются.
 */
export function useSyncedState<T>(
  source: T,
  merge?: (server: T, local: T) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(source);
  const [seen, setSeen] = useState(source);

  if (source !== seen) {
    // Обновление состояния во время рендера — штатный приём React для
    // «состояние зависит от пропса»: без лишнего кадра со старыми данными.
    setSeen(source);
    setState(merge ? merge(source, state) : source);
  }

  return [state, setState];
}

/** Временный id оптимистичной записи, ещё не подтверждённой сервером. */
export function isLocalId(id: string): boolean {
  return id.includes("-local-");
}

/**
 * Серверный список плюс то, чего сервер ещё не знает: записи с временным id
 * и записи, подтверждённые этим клиентом, но не попавшие в снимок (снимок
 * мог уйти чуть раньше, чем закоммитилась вставка).
 */
export function mergeById<T extends { id: string }>(
  server: T[],
  local: T[],
  confirmed: ReadonlySet<string>,
  order?: (a: T, b: T) => number,
): T[] {
  const known = new Set(server.map((item) => item.id));
  const extra = local.filter(
    (item) => !known.has(item.id) && (isLocalId(item.id) || confirmed.has(item.id)),
  );
  if (extra.length === 0) return server;
  const out = [...server, ...extra];
  return order ? out.sort(order) : out;
}
