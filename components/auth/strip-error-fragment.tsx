"use client";

import { useEffect } from "react";

/**
 * GoTrue на отказ по ссылке из письма дописывает к адресу фрагмент
 * `#error=access_denied&error_code=otp_expired&…`, и браузер переносит его
 * через наш редирект. Объяснение на экране уже есть (?error=link), а
 * технический хвост в адресной строке человеку не нужен — убираем его, не
 * перезагружая страницу. Фрагменты без `error` не трогаем.
 */
export function StripErrorFragment() {
  useEffect(() => {
    if (window.location.hash.startsWith("#error")) {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);
  return null;
}
