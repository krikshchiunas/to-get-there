"use client";

/**
 * Короткое сообщение внизу экрана — о том, что действие не прошло.
 *
 * Оптимистичные обновления меняют экран сразу, а ответ сервера приходит
 * позже. Если сервер отказал, экран откатывается, и человеку нужно сказать
 * почему — иначе изменение просто молча исчезло бы. Хост монтируется один
 * раз в оболочке приложения, вызвать можно откуда угодно через `notify()`.
 */

import { useEffect, useState } from "react";

const EVENT = "tgt-toast";

interface ToastDetail {
  message: string;
  tone: "error" | "info";
}

export function notify(message: string, tone: ToastDetail["tone"] = "error") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(EVENT, { detail: { message, tone } }));
}

export function ToastHost() {
  const [toast, setToast] = useState<(ToastDetail & { key: number }) | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onToast(event: Event) {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      setToast({ ...detail, key: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 4500);
    }
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8"
    >
      {toast ? (
        <p
          key={toast.key}
          role={toast.tone === "error" ? "alert" : "status"}
          className={`u-rise pointer-events-auto max-w-[30rem] rounded-field px-4 py-3 text-[14px] leading-[1.4] ${
            toast.tone === "error" ? "bg-ink text-paper" : "bg-sunken text-ink"
          }`}
        >
          {toast.message}
        </p>
      ) : null}
    </div>
  );
}
