/**
 * Content-Security-Policy приложения.
 *
 * Скрипты — только со своим nonce (его ставит middleware на каждый запрос,
 * Next проставляет его своим скриптам сам) и то, что они подгрузили
 * ('strict-dynamic'). Даже если чужой <script> где-то окажется в разметке,
 * браузер его не выполнит.
 *
 * Сторонние источники — ровно те, без которых приложение не работает:
 * Supabase (API, realtime, картинки из Storage) и тайлы карты. Встраивать
 * приложение во фрейм нельзя никому — против кликджекинга.
 */

export interface CspOptions {
  nonce: string;
  dev: boolean;
  supabaseUrl: string | undefined;
  /** Шаблон тайлов, как в NEXT_PUBLIC_MAP_TILE_URL. */
  tileUrl: string | undefined;
  /** Хосты моковых аватаров — только в режиме моков. */
  mocks: boolean;
}

export const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Источник тайлов из шаблона: `{s}.tile...` → `*.tile...`. */
export function tileSource(template: string): string | null {
  try {
    const url = new URL(template.replace(/\{s\}/g, "a").replace(/\{[a-z]\}/g, "0"));
    if (url.protocol !== "https:") return null;
    const host = template.includes("{s}.") ? `*.${url.host.split(".").slice(1).join(".")}` : url.host;
    return `https://${host}`;
  } catch {
    return null;
  }
}

function origin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(options: CspOptions): string {
  const supabase = origin(options.supabaseUrl);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : null;
  const tiles = tileSource(options.tileUrl || DEFAULT_TILE_URL);
  const mockImages = options.mocks ? ["https://images.unsplash.com", "https://api.dicebear.com"] : [];

  const directives: Record<string, (string | null | false)[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${options.nonce}'`,
      "'strict-dynamic'",
      // Fast Refresh в разработке собирает модули через eval.
      options.dev && "'unsafe-eval'",
    ],
    // Next, Tailwind и Leaflet ставят стили атрибутом style.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", supabase, tiles, ...mockImages],
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabase, supabaseWs, options.dev && "ws:"],
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
  };

  const parts = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.filter(Boolean).join(" ")}`,
  );
  if (!options.dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** Случайный nonce, 128 бит, base64. Работает в Edge и в Node. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
