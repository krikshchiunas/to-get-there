"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

/**
 * Живой экран: по сигналу из базы сервер перерисовывает страницу
 * (router.refresh), а клиент сливает свежие данные с локальными через
 * useSyncedState.
 *
 * Сигналы шлют триггеры из 0018 в приватные каналы:
 *   post:<uuid> — что-то изменилось в идее или её чате;
 *   user:<uuid> — пришло личное сообщение или уведомление.
 * В сигнале нет данных. Всё, что видит экран, по-прежнему приходит с
 * сервера через RLS — второй копии логики прав на клиенте нет.
 *
 * Пачка сигналов (пятеро проголосовали разом) схлопывается в один refresh.
 * Пропущенное, пока вкладка спала или сокет переподключался, догоняется
 * refresh'ем при возвращении на вкладку и после повторной подписки.
 */
export function useLiveRefresh(topic: string | null, delayMs = 250) {
  const router = useRouter();

  useEffect(() => {
    if (usingMocks || !topic) return;

    const supabase = createClient();
    let timer: number | null = null;
    let subscribedOnce = false;
    let cancelled = false;

    const refresh = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        router.refresh();
      }, delayMs);
    };

    const channel = supabase
      .channel(topic, { config: { private: true } })
      .on("broadcast", { event: "changed" }, refresh);

    // Приватному каналу нужен токен сессии до подключения.
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel.subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (subscribedOnce) refresh();
        subscribedOnce = true;
      });
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer !== null) window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [topic, delayMs, router]);
}

/** Невидимый слушатель для серверных макетов, где хуки недоступны. */
export function LiveRefresh({ topic }: { topic: string | null }) {
  useLiveRefresh(topic);
  return null;
}
