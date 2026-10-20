import { describe, expect, it } from "vitest";
import { explainVerificationError } from "./verification-text";

describe("explainVerificationError", () => {
  it("каждый известный код — своя понятная причина", () => {
    const codes = [
      "consent_declined",
      "device_not_supported",
      "document_expired",
      "document_type_not_supported",
      "document_unverified_other",
      "selfie_document_missing_photo",
      "selfie_face_mismatch",
      "selfie_manipulated",
      "under_supported_age",
    ];
    const texts = codes.map(explainVerificationError);
    expect(new Set(texts).size).toBe(codes.length);
    for (const text of texts) expect(text).not.toBe(explainVerificationError(null));
  });

  it("неизвестный код и null — общий текст с подсказкой попробовать ещё", () => {
    expect(explainVerificationError("something_new")).toBe(explainVerificationError(null));
    expect(explainVerificationError(null)).toContain("ещё раз");
  });
});
