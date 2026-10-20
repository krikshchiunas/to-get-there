/**
 * Редирект по относительному пути — на тот же хост, куда пришёл запрос.
 *
 * Не NextResponse.redirect(new URL(path, request.nextUrl)): в `next start` и
 * за прокси request.nextUrl — адрес самого сервера (localhost), а не тот, что
 * в адресной строке. Cookie сессии ставятся на хост запроса, и редирект на
 * другой хост их бы потерял. Относительный Location браузер разрешает от
 * текущего адреса (RFC 9110, 10.2.2).
 */
export function relativeRedirect(path: string): Response {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(`relativeRedirect ждёт путь внутри сайта, а не ${path}`);
  }
  return new Response(null, { status: 303, headers: { Location: path } });
}
