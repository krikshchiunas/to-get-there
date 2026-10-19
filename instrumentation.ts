/**
 * Журнал ошибок сервера.
 *
 * Next вызывает onRequestError на каждую необработанную ошибку в серверных
 * компонентах, действиях и маршрутах. Одна строка JSON на ошибку — Vercel
 * показывает её в Logs и Observability, по ней настраиваются алерты, а
 * digest совпадает с кодом, который человек видит на странице ошибки.
 *
 * Без сторонних SDK: поток уже собирает Vercel, а внешний сервис
 * мониторинга добавляется дрейном логов (Vercel → Settings → Drains), без
 * правки кода. Личных данных в строке нет: ни cookies, ни тела запроса.
 */
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      event: "request_error",
      digest: err.digest ?? null,
      name: err.name,
      message: err.message,
      method: request.method,
      // Путь без query: в query бывают одноразовые коды из писем.
      path: request.path.split("?")[0],
      route: context.routePath,
      router: context.routerKind,
      kind: context.routeType,
      render: context.renderSource ?? null,
      at: new Date().toISOString(),
    }),
  );
};
