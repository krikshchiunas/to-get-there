/**
 * Проверка полей входа, регистрации и смены пароля.
 *
 * Один модуль и для формы, и для сервера: форма показывает ошибку у поля
 * сразу, не дожидаясь ответа, а server action проверяет то же самое ещё
 * раз — его можно вызвать в обход формы. Пароль решает Supabase Auth (там же
 * минимальная длина — supabase/config.toml), здесь — только то, что можно
 * объяснить человеку до отправки.
 *
 * Требования к паролю намеренно мягкие: длина, а не «заглавная, цифра и
 * спецсимвол». Такие правила дают «Password1!», а не стойкие пароли
 * (NIST SP 800-63B, 5.1.1.2); от утёкших паролей защищает проверка в
 * Supabase (docs/SECURITY.md).
 */

export const MIN_PASSWORD = 8;
/** bcrypt в Supabase Auth смотрит только на первые 72 байта. */
export const MAX_PASSWORD_BYTES = 72;
/** RFC 5321: адрес длиннее 254 символов не доставить. */
export const MAX_EMAIL = 254;

export const PASSWORD_HINT = `Не короче ${MIN_PASSWORD} символов. Можно фразу из нескольких слов.`;

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

/** Почта в том виде, в каком её хранит Auth: без краевых пробелов, строчными. */
export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/** Пароль как есть: пробелы — часть пароля, их не обрезаем. */
export function readPassword(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

// Намеренно не RFC 5322 целиком: адрес проверяет письмо, а здесь — что это
// похоже на адрес и опечатку видно сразу.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

export function emailProblem(email: string): string | null {
  if (!email) return "Введи почту.";
  if (email.length > MAX_EMAIL) return "Адрес слишком длинный. Проверь, что он написан верно.";
  if (!EMAIL_SHAPE.test(email)) return "Введи адрес почты целиком — например, имя@gmail.com.";
  return null;
}

export function passwordProblem(password: string): string | null {
  if (!password) return "Придумай пароль.";
  if ([...password].length < MIN_PASSWORD) return `Пароль должен быть не короче ${MIN_PASSWORD} символов.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return `Пароль должен быть не длиннее ${MAX_PASSWORD_BYTES} байт — примерно ${MAX_PASSWORD_BYTES} латинских символов.`;
  }
  return null;
}

function repeatProblem(password: string, repeat: string): string | null {
  if (!repeat) return "Повтори пароль.";
  return password === repeat ? null : "Пароли не совпадают.";
}

function compact<F extends string>(errors: Record<F, string | null>): FieldErrors<F> {
  const out: FieldErrors<F> = {};
  for (const key of Object.keys(errors) as F[]) {
    const message = errors[key];
    if (message) out[key] = message;
  }
  return out;
}

export function hasErrors(errors: FieldErrors<string>): boolean {
  return Object.keys(errors).length > 0;
}

export type LoginField = "email" | "password";

export function validateLogin(input: { email: string; password: string }): FieldErrors<LoginField> {
  // При входе длину пароля не проверяем: старый пароль мог быть задан по
  // прежним правилам, а «неверный пароль» скажет Auth.
  return compact<LoginField>({
    email: emailProblem(input.email),
    password: input.password ? null : "Введи пароль.",
  });
}

export type SignupField = "email" | "password" | "repeat" | "terms";

export function validateSignup(input: {
  email: string;
  password: string;
  repeat: string;
  terms: boolean;
}): FieldErrors<SignupField> {
  const password = passwordProblem(input.password);
  return compact<SignupField>({
    email: emailProblem(input.email),
    password,
    // Повтор проверяем, только когда сам пароль годится: иначе две ошибки
    // об одном и том же.
    repeat: password ? null : repeatProblem(input.password, input.repeat),
    terms: input.terms ? null : "Чтобы создать аккаунт, подтверди возраст и согласие с условиями.",
  });
}

export type NewPasswordField = "password" | "repeat";

export function validateNewPassword(password: string, repeat: string): FieldErrors<NewPasswordField> {
  const problem = passwordProblem(password);
  return compact<NewPasswordField>({
    password: problem,
    repeat: problem ? null : repeatProblem(password, repeat),
  });
}

export type ChangePasswordField = "current" | "password" | "repeat";

export function validatePasswordChange(input: {
  current: string;
  password: string;
  repeat: string;
}): FieldErrors<ChangePasswordField> {
  const fresh = validateNewPassword(input.password, input.repeat);
  return compact<ChangePasswordField>({
    current: input.current ? null : "Введи текущий пароль.",
    password:
      fresh.password ??
      (input.current && input.current === input.password
        ? "Новый пароль должен отличаться от текущего."
        : null),
    repeat: fresh.repeat ?? null,
  });
}
