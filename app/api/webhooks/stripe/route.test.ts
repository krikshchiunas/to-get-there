import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signStripePayload } from "@/lib/stripe-identity";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

const { POST } = await import("./route");

const SECRET = "whsec_route_test";
const USER = "3c77304a-29bc-4617-b9b2-7085efb7bea0";

function request(body: string, signature: string | null) {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "content-type": "application/json", ...(signature ? { "stripe-signature": signature } : {}) },
    body,
  });
}

function signed(event: unknown) {
  const body = JSON.stringify(event);
  return request(body, signStripePayload(body, SECRET, Math.floor(Date.now() / 1000)));
}

const verified = {
  type: "identity.verification_session.verified",
  data: { object: { id: "vs_abc", metadata: { user_id: USER } } },
};

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_x");
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/webhooks/stripe", () => {
  it("без ключей отвечает 503 и ничего не пишет", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const response = await POST(signed(verified));
    expect(response.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("без подписи — 400, база не тронута", async () => {
    const response = await POST(request(JSON.stringify(verified), null));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("с подписью чужим секретом — 400", async () => {
    const body = JSON.stringify(verified);
    const response = await POST(
      request(body, signStripePayload(body, "whsec_attacker", Math.floor(Date.now() / 1000))),
    );
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("записывает итог, user_id — из metadata сессии", async () => {
    const response = await POST(signed(verified));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("apply_verification_result", {
      session_id: "vs_abc",
      member: USER,
      new_status: "verified",
      error_code: undefined,
    });
  });

  it("передаёт причину отказа", async () => {
    await POST(
      signed({
        type: "identity.verification_session.requires_input",
        data: {
          object: { id: "vs_abc", metadata: { user_id: USER }, last_error: { code: "document_expired" } },
        },
      }),
    );
    expect(rpc).toHaveBeenCalledWith(
      "apply_verification_result",
      expect.objectContaining({
        new_status: "requires_input",
        error_code: "document_expired",
      }),
    );
  });

  it("чужие события подтверждает 200, но в базу не пишет", async () => {
    const response = await POST(signed({ type: "charge.succeeded", data: { object: {} } }));
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("сбой записи — 500, чтобы Stripe повторил", async () => {
    rpc.mockResolvedValue({ error: { code: "XX000" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(signed(verified));
    expect(response.status).toBe(500);
  });

  it("слишком большое тело — 413", async () => {
    const response = await POST(request("x".repeat(300 * 1024), "t=1,v1=" + "0".repeat(64)));
    expect(response.status).toBe(413);
  });
});
