import { describe, expect, it } from "vitest";
import {
  explainVerificationError,
  identityConfigured,
  outcomeOf,
  sessionRequestBody,
  signStripePayload,
  verifyStripeSignature,
} from "./stripe-identity";

const SECRET = "whsec_test_secret";
const NOW = 1_800_000_000;
const USER = "3c77304a-29bc-4617-b9b2-7085efb7bea0";

const event = (type: string, extra: Record<string, unknown> = {}) => ({
  type,
  data: { object: { id: "vs_123", metadata: { user_id: USER }, ...extra } },
});

describe("verifyStripeSignature", () => {
  const payload = JSON.stringify(event("identity.verification_session.verified"));

  it("принимает подпись Stripe", () => {
    expect(verifyStripeSignature(payload, signStripePayload(payload, SECRET, NOW), SECRET, NOW)).toBe(true);
  });

  it("отклоняет подделанное тело — подпись от другого текста", () => {
    const header = signStripePayload(payload, SECRET, NOW);
    expect(verifyStripeSignature(payload.replace("verified", "canceled"), header, SECRET, NOW)).toBe(false);
  });

  it("отклоняет подпись чужим секретом", () => {
    expect(verifyStripeSignature(payload, signStripePayload(payload, "whsec_other", NOW), SECRET, NOW)).toBe(
      false,
    );
  });

  it("отклоняет старый вебхук — повтор перехваченного запроса", () => {
    const header = signStripePayload(payload, SECRET, NOW - 301);
    expect(verifyStripeSignature(payload, header, SECRET, NOW)).toBe(false);
  });

  it("принимает, если среди подписей одна верная (смена секрета)", () => {
    const good = signStripePayload(payload, SECRET, NOW).split(",")[1];
    const header = `t=${NOW},v1=${"0".repeat(64)},${good}`;
    expect(verifyStripeSignature(payload, header, SECRET, NOW)).toBe(true);
  });

  it("отклоняет пустой и кривой заголовок, пустой секрет", () => {
    expect(verifyStripeSignature(payload, null, SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(payload, "garbage", SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(payload, `t=${NOW},v1=zz`, SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(payload, signStripePayload(payload, "", NOW), "", NOW)).toBe(false);
  });

  it("не принимает схему v0 вместо v1", () => {
    const v1 = signStripePayload(payload, SECRET, NOW).split("v1=")[1];
    expect(verifyStripeSignature(payload, `t=${NOW},v0=${v1}`, SECRET, NOW)).toBe(false);
  });
});

describe("outcomeOf", () => {
  it("достаёт итог из события verified", () => {
    expect(outcomeOf(event("identity.verification_session.verified"))).toEqual({
      sessionId: "vs_123",
      userId: USER,
      status: "verified",
      errorCode: null,
    });
  });

  it("берёт код причины из requires_input", () => {
    const outcome = outcomeOf(
      event("identity.verification_session.requires_input", { last_error: { code: "selfie_face_mismatch" } }),
    );
    expect(outcome?.status).toBe("requires_input");
    expect(outcome?.errorCode).toBe("selfie_face_mismatch");
  });

  it("пропускает события не про итог", () => {
    expect(outcomeOf(event("identity.verification_session.created"))).toBeNull();
    expect(outcomeOf(event("payment_intent.succeeded"))).toBeNull();
  });

  it("пропускает сессии без нашего user_id", () => {
    expect(
      outcomeOf({ type: "identity.verification_session.verified", data: { object: { id: "vs_1" } } }),
    ).toBeNull();
    expect(
      outcomeOf({
        type: "identity.verification_session.verified",
        data: { object: { id: "vs_1", metadata: { user_id: "'; drop table users;--" } } },
      }),
    ).toBeNull();
  });

  it("не падает на мусоре", () => {
    expect(outcomeOf(null)).toBeNull();
    expect(outcomeOf("x")).toBeNull();
    expect(outcomeOf({ type: 1 })).toBeNull();
  });
});

describe("sessionRequestBody", () => {
  it("просит селфи, живую съёмку и привязывает сессию к человеку", () => {
    const body = sessionRequestBody(USER, "https://app.example/settings/verification");
    expect(body.get("type")).toBe("document");
    expect(body.get("metadata[user_id]")).toBe(USER);
    expect(body.get("options[document][require_matching_selfie]")).toBe("true");
    expect(body.get("options[document][require_live_capture]")).toBe("true");
    expect(body.getAll("options[document][allowed_types][]")).toEqual([
      "passport",
      "id_card",
      "driving_license",
    ]);
  });
});

describe("identityConfigured", () => {
  it("требует все три ключа", () => {
    expect(identityConfigured({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      identityConfigured({
        STRIPE_SECRET_KEY: "sk",
        STRIPE_WEBHOOK_SECRET: "wh",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      identityConfigured({
        STRIPE_SECRET_KEY: "sk",
        STRIPE_WEBHOOK_SECRET: "wh",
        SUPABASE_SECRET_KEY: "sb",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });
});

describe("explainVerificationError", () => {
  it("объясняет известные коды и не молчит на неизвестных", () => {
    expect(explainVerificationError("document_expired")).toMatch(/истёк/);
    expect(explainVerificationError("whatever")).toMatch(/не прошла/);
    expect(explainVerificationError(null)).toMatch(/не прошла/);
  });
});
