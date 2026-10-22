/**
 * Что о запросе нужно подсистеме входа: адрес клиента для лимитов и
 * идентификатор запроса для журнала.
 *
 * Адрес — только для лимитов попыток, наружу и в журнал он не попадает.
 * На Vercel достоверен x-vercel-forwarded-for: его ставит платформа, и
 * клиент его не подделает. Остальные заголовки — лучшая догадка для
 * локального запуска и CI; за чужим прокси их может прислать сам клиент,
 * поэтому лимит по почте от адреса не зависит (0043).
 */

export interface HeaderSource {
  get(name: string): string | null;
}

function firstAddress(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first ? first.slice(0, 64) : null;
}

export function clientAddress(headers: HeaderSource): string | null {
  return (
    firstAddress(headers.get("x-vercel-forwarded-for")) ??
    firstAddress(headers.get("x-real-ip")) ??
    firstAddress(headers.get("x-forwarded-for"))
  );
}

/** Идентификатор запроса: у Vercel свой, локально — случайный. */
export function requestIdOf(headers: HeaderSource): string {
  const given = headers.get("x-vercel-id") ?? headers.get("x-request-id");
  if (given && /^[\w:.-]{1,128}$/.test(given)) return given;
  return crypto.randomUUID();
}
