import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyPassword = vi.fn();
vi.mock("@/lib/supabase/auth", () => ({ verifyPassword }));
vi.mock("./report", () => ({
  reportAuthFailure: vi.fn(async (_op: string, _route: string, failure: unknown) =>
    typeof failure === "string" ? failure : "server",
  ),
}));

const { confirmIdentity } = await import("./reauth");

function client(rpcError: { code: string } | null) {
  const rpc = vi.fn(async () => ({ data: null, error: rpcError }));
  return { supabase: { rpc } as never, rpc };
}

describe("confirmIdentity — пароль изнутри сессии", () => {
  beforeEach(() => verifyPassword.mockReset());

  it("сначала попытка засчитывается в лимит, потом проверяется пароль", async () => {
    const { supabase, rpc } = client(null);
    verifyPassword.mockResolvedValue("ok");
    expect(await confirmIdentity(supabase, "a@b.de", "secret", "/settings/security")).toBe("ok");
    expect(rpc).toHaveBeenCalledWith("claim_reauth_attempt");
    expect(verifyPassword).toHaveBeenCalledWith("a@b.de", "secret");
  });

  it("лимит исчерпан (P0429) — пароль даже не проверяется", async () => {
    const { supabase } = client({ code: "P0429" });
    expect(await confirmIdentity(supabase, "a@b.de", "secret", "/settings/security")).toBe("rate_limited");
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("сессия отозвана (42501) — «войди снова»", async () => {
    const { supabase } = client({ code: "42501" });
    expect(await confirmIdentity(supabase, "a@b.de", "secret", "/settings/account")).toBe("session_missing");
  });

  it("другой сбой базы — server", async () => {
    const { supabase } = client({ code: "XX000" });
    expect(await confirmIdentity(supabase, "a@b.de", "secret", "/settings/account")).toBe("server");
  });

  it("неверный пароль — так и говорим", async () => {
    const { supabase } = client(null);
    verifyPassword.mockResolvedValue("invalid_credentials");
    expect(await confirmIdentity(supabase, "a@b.de", "wrong", "/settings/security")).toBe(
      "invalid_credentials",
    );
  });

  it("пустой пароль — без похода в базу и в Auth", async () => {
    const { supabase, rpc } = client(null);
    expect(await confirmIdentity(supabase, "a@b.de", "", "/settings/security")).toBe("invalid_credentials");
    expect(rpc).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });
});
