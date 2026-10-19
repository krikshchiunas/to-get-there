/**
 * Тексты для экрана верификации. Отдельно от lib/stripe-identity.ts: тот
 * работает с node:crypto и в браузер не попадает, а эти строки нужны там.
 */

/** Причина отказа человеческим языком. Неизвестный код — общий текст. */
export function explainVerificationError(code: string | null): string {
  switch (code) {
    case "consent_declined":
      return "Проверку прервали до конца — согласие на обработку не дано.";
    case "device_not_supported":
      return "Камера этого устройства не подошла. Попробуй с телефона.";
    case "document_expired":
      return "Срок действия документа истёк. Нужен действующий.";
    case "document_type_not_supported":
      return "Такой документ не принимается. Подойдут паспорт, ID-карта или права.";
    case "document_unverified_other":
      return "Документ не удалось проверить. Сфотографируй его целиком, без бликов.";
    case "selfie_document_missing_photo":
      return "На документе не нашлось фото лица.";
    case "selfie_face_mismatch":
      return "Лицо на селфи не совпало с фото в документе.";
    case "selfie_manipulated":
    case "selfie_unverified_other":
      return "Селфи не удалось проверить. Попробуй ещё раз при хорошем свете.";
    case "under_supported_age":
      return "Проверка доступна только совершеннолетним.";
    default:
      return "Проверка не прошла. Можно попробовать ещё раз.";
  }
}
