/**
 * Ответ server action формы входа — общий для всех экранов /auth и
 * «Вход и безопасность».
 *
 * Пароли обратно не возвращаются никогда: ни в состоянии, ни в HTML. Почта
 * возвращается, чтобы при ошибке не набирать её заново.
 */

import type { FieldErrors } from "./validation";

export interface FormState<F extends string = string> {
  status: "idle" | "error" | "success";
  fieldErrors: FieldErrors<F>;
  /** Ошибка не про одно поле — показывается над кнопкой. */
  formError: string | null;
  /** Итог на месте, без перехода: «пароль изменён», «письмо отправлено ещё раз». */
  notice: string | null;
  email: string;
  /** Вход с неподтверждённой почтой: предложить отправить письмо ещё раз. */
  unconfirmed?: boolean;
}

export const initialFormState: FormState = {
  status: "idle",
  fieldErrors: {},
  formError: null,
  notice: null,
  email: "",
};

export function fieldFailure<F extends string>(email: string, fieldErrors: FieldErrors<F>): FormState<F> {
  return { status: "error", fieldErrors, formError: null, notice: null, email };
}

export function formFailure<F extends string>(
  email: string,
  formError: string,
  extra?: Partial<FormState<F>>,
): FormState<F> {
  return { status: "error", fieldErrors: {}, formError, notice: null, email, ...extra };
}

export function formSuccess<F extends string>(notice: string, email = ""): FormState<F> {
  return { status: "success", fieldErrors: {}, formError: null, notice, email };
}
