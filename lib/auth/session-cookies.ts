/**
 * Cookie сессии Supabase: `sb-<проект>-auth-token`, длинная — частями `.0`,
 * `.1`…, плюс `-code-verifier` для ссылок PKCE.
 */
const SESSION_TOKEN = /^sb-[a-z0-9-]+-auth-token(\.\d+)?$/;
const CODE_VERIFIER = /^sb-[a-z0-9-]+-auth-token-code-verifier(\.\d+)?$/;

/** Сама сессия. Была, а входа нет — значит, срок вышел или сессию отозвали. */
export function isSessionTokenCookie(name: string): boolean {
  return SESSION_TOKEN.test(name);
}

/**
 * Всё, что выход должен стереть: если Auth не ответил, supabase-js оставит
 * сессию в cookie, а выход на этом устройстве обязан сработать в любом случае.
 */
export function isSessionCookie(name: string): boolean {
  return SESSION_TOKEN.test(name) || CODE_VERIFIER.test(name);
}
