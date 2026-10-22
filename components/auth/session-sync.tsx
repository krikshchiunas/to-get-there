"use client";

import { useEffect } from "react";

/**
 * Выход в одной вкладке — выход во всех вкладках этого браузера.
 *
 * Cookie общие, поэтому другие вкладки и так потеряют доступ на следующем
 * запросе (middleware). Но до него они показывали бы последние данные
 * аккаунта. Экран «Ты вышел» сообщает о выходе остальным вкладкам, и они
 * сразу уходят на вход. BroadcastChannel не покидает браузер и не несёт
 * ничего, кроме слова «вышел».
 */
const CHANNEL = "tgt-auth";
const SIGNED_OUT = "signed-out";

/** В оболочке приложения: услышал «вышел» — уходи на вход. */
export function SessionSync() {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => {
      if (event.data === SIGNED_OUT) window.location.replace("/auth/login");
    };
    return () => channel.close();
  }, []);
  return null;
}

/** На экране входа после выхода: сказать остальным вкладкам. Cookie уже стёрты. */
export function AnnounceSignedOut() {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(SIGNED_OUT);
    channel.close();
  }, []);
  return null;
}
