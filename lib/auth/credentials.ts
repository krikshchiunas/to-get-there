/**
 * Почта и пароль: что принимаем на входе, регистрации и смене пароля.
 *
 * Одни и те же правила проверяют форму в браузере (чтобы ответить сразу)
 * и серверное действие (потому что браузеру верить нельзя). Правил ровно
 * столько, сколько нужно Supabase Auth и bcrypt: без «заглавной, цифры и
 * спецсимвола» — длина важнее, а менеджеры паролей генерируют длинные.
 */

export const MIN_PASSWORD = 8;
/** bcrypt в GoTrue смотрит только на первые 72 байта: длиннее — обман. */
export const MAX_PASSWORD_BYTES = 72;
/** RFC 5321: адрес не длиннее 254 символов. */
const MAX_EMAIL = 254;

/** Поле, к которому относится ошибка: на него переводится фокус. */
export type CredentialField = "email" | "password" | "repeat";

export interface CredentialProblem {
  field: CredentialField;
  message: string;
}

/** Как адрес хранится и сравнивается: без пробелов по краям, в нижнем регистре. */
export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/**
 * Похоже ли на адрес почты. Проверка грубая намеренно: доставимость решает
 * письмо подтверждения, а не регулярное выражение.
 */
export function checkEmail(email: string): CredentialProblem | null {
  if (!email) return { field: "email", message: "Введи адрес почты." };
  if (email.length > MAX_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { field: "email", message: "Введи адрес почты целиком — например, имя@почта.de." };
  }
  return null;
}

export function checkPassword(password: string): CredentialProblem | null {
  if (password.length < MIN_PASSWORD) {
    return { field: "password", message: `Пароль должен быть не короче ${MIN_PASSWORD} символов.` };
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return {
      field: "password",
      message: `Пароль должен быть не длиннее ${MAX_PASSWORD_BYTES} байт — примерно ${MAX_PASSWORD_BYTES} латинских символов.`,
    };
  }
  return null;
}

/** Новый пароль дважды — при регистрации и при сбросе. */
export function checkNewPassword(password: string, repeat: string): CredentialProblem | null {
  const problem = checkPassword(password);
  if (problem) return problem;
  if (password !== repeat) return { field: "repeat", message: "Пароли не совпадают." };
  return null;
}

/** Регистрация: почта, пароль и его повтор — первая ошибка по порядку полей. */
export function checkSignUp(email: string, password: string, repeat: string): CredentialProblem | null {
  return checkEmail(email) ?? checkNewPassword(password, repeat);
}

/** Вход: только чтобы не гонять пустую форму на сервер; длину пароля не проверяем — он уже есть. */
export function checkSignIn(email: string, password: string): CredentialProblem | null {
  return checkEmail(email) ?? (password ? null : { field: "password", message: "Введи пароль." });
}
