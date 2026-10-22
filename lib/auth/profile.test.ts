import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { profileIdFor } from "./profile";

/** Ровно те вызовы клиента, что делает profileIdFor. */
function client(found: { id: string } | null, repair: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: found, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue(repair);
  return { supabase: { from, rpc } as unknown as SupabaseClient<Database>, from, eq, rpc };
}

describe("profileIdFor", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("профиль ищется по auth_user_id — не по почте и не по тому, что прислал клиент", async () => {
    const c = client({ id: "profile-1" }, { data: null, error: null });
    await expect(profileIdFor(c.supabase, "auth-1")).resolves.toBe("profile-1");
    expect(c.from).toHaveBeenCalledWith("users");
    expect(c.eq).toHaveBeenCalledWith("auth_user_id", "auth-1");
    expect(c.rpc).not.toHaveBeenCalled();
  });

  it("профиля нет — создаётся ensure_my_profile, и это пишется в журнал", async () => {
    const c = client(null, { data: "profile-2", error: null });
    await expect(profileIdFor(c.supabase, "auth-2")).resolves.toBe("profile-2");
    expect(c.rpc).toHaveBeenCalledWith("ensure_my_profile");
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"op":"profile_repair"'));
  });

  it("не восстановился — null (вызывающий покажет ошибку, а не цикл редиректов)", async () => {
    const c = client(null, { data: null, error: { code: "42501" } });
    await expect(profileIdFor(c.supabase, "auth-3")).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"outcome":"failure"'));
  });
});
