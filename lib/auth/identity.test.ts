import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { verifiedAuthUserId } from "./identity";

/** Ровно те вызовы клиента, что делает verifiedAuthUserId. */
function client(getClaims: () => Promise<unknown>, user: { id: string } | null = null) {
  const getUser = vi.fn().mockResolvedValue({ data: { user }, error: null });
  const supabase = { auth: { getClaims: vi.fn(getClaims), getUser } } as unknown as SupabaseClient<Database>;
  return { supabase, getUser };
}

describe("verifiedAuthUserId", () => {
  it("подпись верна — id из sub, без запроса к серверу Auth", async () => {
    const c = client(async () => ({ data: { claims: { sub: "auth-1" } }, error: null }));
    await expect(verifiedAuthUserId(c.supabase)).resolves.toBe("auth-1");
    expect(c.getUser).not.toHaveBeenCalled();
  });

  it("сессии нет — не вошёл", async () => {
    const c = client(async () => ({ data: null, error: null }));
    await expect(verifiedAuthUserId(c.supabase)).resolves.toBeNull();
    expect(c.getUser).not.toHaveBeenCalled();
  });

  it("подпись не сошлась или токен истёк — не вошёл, и сервер не переспрашивается", async () => {
    const c = client(async () => ({ data: null, error: { name: "AuthInvalidJwtError" } }));
    await expect(verifiedAuthUserId(c.supabase)).resolves.toBeNull();
    expect(c.getUser).not.toHaveBeenCalled();
  });

  it("в токене нет sub — не вошёл", async () => {
    const c = client(async () => ({ data: { claims: { sub: "" } }, error: null }));
    await expect(verifiedAuthUserId(c.supabase)).resolves.toBeNull();
  });

  it("сбой по дороге к ключу — спрашиваем сервер Auth, а не выкидываем человека", async () => {
    const c = client(
      async () => {
        throw new TypeError("fetch failed");
      },
      { id: "auth-2" },
    );
    await expect(verifiedAuthUserId(c.supabase)).resolves.toBe("auth-2");
    expect(c.getUser).toHaveBeenCalled();
  });
});
