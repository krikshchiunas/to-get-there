"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

/** Как часто можно сообщать «печатаю»: чаще — лишний трафик, реже — индикатор мигает. */
const TYPING_THROTTLE_MS = 2500;
/** Сколько держать «печатает», если новых событий нет. */
const TYPING_TTL_MS = 5000;

/**
 * «Печатает…» и «сейчас в чате» поверх каналов из 0033:
 *   chat:<post_id>  — чат идеи;
 *   dm:<a>:<b>      — личка.
 *
 * В событиях только id. Имя для показа берёт вызывающий из своего состава
 * чата (allowedIds): Realtime не подписывает отправителя, и имя из payload
 * можно было бы подделать, а id вне состава просто игнорируется.
 *
 * `canTrack` — может ли зритель сам отмечаться и печатать (участник чата,
 * собеседник в личке). Остальные только слушают — так же решает политика.
 */
export function usePresence({
  topic,
  viewerId,
  canTrack,
  allowedIds,
}: {
  topic: string | null;
  viewerId: string;
  canTrack: boolean;
  allowedIds: ReadonlySet<string>;
}) {
  const [typingIds, setTypingIds] = useState<string[]>([]);
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const lastSent = useRef(0);
  const expiry = useRef(new Map<string, number>());

  // Состав меняется по ходу (вступили, исключили) — читаем его из ref, чтобы
  // не переподписываться на канал при каждом изменении.
  const allowed = useRef(allowedIds);
  allowed.current = allowedIds;

  useEffect(() => {
    if (usingMocks || !topic) return;

    const supabase = createClient();
    let cancelled = false;
    const timers = expiry.current;

    const channel = supabase.channel(topic, {
      config: { private: true, broadcast: { self: false }, presence: { key: viewerId } },
    });
    channelRef.current = channel;

    const sweep = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, until] of timers) {
        if (until <= now) {
          timers.delete(id);
          changed = true;
        }
      }
      if (changed) setTypingIds([...timers.keys()]);
    }, 1000);

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const id = (payload as { id?: unknown } | undefined)?.id;
        const stopped = (payload as { stop?: unknown } | undefined)?.stop === true;
        if (typeof id !== "string" || id === viewerId || !allowed.current.has(id)) return;
        if (stopped) timers.delete(id);
        else timers.set(id, Date.now() + TYPING_TTL_MS);
        setTypingIds([...timers.keys()]);
      })
      .on("presence", { event: "sync" }, () => {
        const ids = Object.keys(channel.presenceState()).filter(
          (id) => id !== viewerId && allowed.current.has(id),
        );
        setPresentIds(ids);
      });

    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" && canTrack) void channel.track({ at: Date.now() });
      });
    });

    return () => {
      cancelled = true;
      window.clearInterval(sweep);
      timers.clear();
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [topic, viewerId, canTrack]);

  /** Вызывать на каждый ввод в поле — частоту ограничивает сам хук. */
  const notifyTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !canTrack) return;
    const now = Date.now();
    if (now - lastSent.current < TYPING_THROTTLE_MS) return;
    lastSent.current = now;
    void channel.send({ type: "broadcast", event: "typing", payload: { id: viewerId } });
  }, [canTrack, viewerId]);

  /** Сообщение отправлено — индикатор у остальных гаснет сразу, а не через пять секунд. */
  const notifyStopped = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !canTrack) return;
    lastSent.current = 0;
    void channel.send({ type: "broadcast", event: "typing", payload: { id: viewerId, stop: true } });
  }, [canTrack, viewerId]);

  return { typingIds, presentIds, notifyTyping, notifyStopped };
}

/** Ключ канала лички — та же сортировка, что у conversation_key (0005). */
export function dmTopic(a: string, b: string): string {
  return a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`;
}
