/**
 * Кто отвечает за сервис — для Impressum (DDG § 5) и политики
 * конфиденциальности (DSGVO ст. 13).
 *
 * Данные оператора не живут в коде: это имя и адрес конкретного человека
 * или компании, они задаются переменными окружения в Vercel. Пока они не
 * заданы, страницы прямо говорят, что Impressum не заполнен, — выдумывать
 * их нельзя, а пустая страница выглядела бы как готовая.
 */

export interface Operator {
  /** Имя и фамилия или название компании с правовой формой. */
  name: string;
  /** Адрес для вызова в суд (ladungsfähige Anschrift): улица, индекс, город. */
  address: string[];
  email: string;
  /** Второй быстрый канал связи — телефон или форма (DDG § 5 Abs. 1 Nr. 2). */
  phone: string | null;
  /** Ответственный за содержание (MStV § 18 Abs. 2); по умолчанию — оператор. */
  contentResponsible: string;
  /** USt-IdNr., если есть. */
  vatId: string | null;
}

export function getOperator(): Operator | null {
  const name = process.env.LEGAL_OPERATOR_NAME?.trim();
  const address = process.env.LEGAL_OPERATOR_ADDRESS?.trim();
  const email = process.env.LEGAL_OPERATOR_EMAIL?.trim();
  if (!name || !address || !email) return null;

  return {
    name,
    // В переменной строки разделены «|» — переносы строк в панели Vercel неудобны.
    address: address
      .split("|")
      .map((line) => line.trim())
      .filter(Boolean),
    email,
    phone: process.env.LEGAL_OPERATOR_PHONE?.trim() || null,
    contentResponsible: process.env.LEGAL_CONTENT_RESPONSIBLE?.trim() || name,
    vatId: process.env.LEGAL_VAT_ID?.trim() || null,
  };
}

/** Дата последней редакции документов. Меняется вместе с текстом. */
export const LEGAL_REVISION = "19 октября 2026";

/** Минимальный возраст: DSGVO ст. 8 и BDSG — согласие самостоятельно с 16 лет. */
export const MIN_AGE = 16;
