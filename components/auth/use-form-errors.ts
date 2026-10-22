"use client";

import { useEffect, useRef, useState, type FocusEvent, type FormEvent } from "react";
import type { FormState } from "@/lib/auth/form-state";
import { hasErrors, type FieldErrors } from "@/lib/auth/validation";

/**
 * Ошибки полей формы входа: свои (проверка в браузере) и ответ сервера.
 *
 * - До отправки форма проверяет поля теми же правилами, что сервер
 *   (lib/auth/validation.ts), и не отправляет заведомо неверное.
 * - Ошибка поля пропадает, как только человек начал его править, — без
 *   крика «неверно» на каждой букве; снова проверяется при уходе с поля.
 * - После ответа фокус встаёт на первое поле с ошибкой, а если ошибка общая —
 *   на её текст: человек с клавиатуры или читалкой сразу там, где чинить.
 *
 * `order` — id полей в порядке на экране; должен быть постоянным (константа
 * модуля), иначе эффект сбрасывал бы ошибки на каждом рендере.
 */
export function useFormErrors<F extends string>(state: FormState<F>, order: readonly F[]) {
  const [own, setOwn] = useState<FieldErrors<F>>({});
  const [edited, setEdited] = useState<ReadonlySet<F>>(() => new Set());
  const alertRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status === "idle") return;
    setOwn({});
    setEdited(new Set());
    const first = order.find((field) => state.fieldErrors[field]);
    if (first) document.getElementById(first)?.focus();
    else if (state.formError) alertRef.current?.focus();
  }, [state, order]);

  function errorOf(field: F): string | undefined {
    return own[field] ?? (edited.has(field) ? undefined : state.fieldErrors[field]);
  }

  /** Человек правит поле — его ошибка больше не актуальна. */
  function clear(field: F) {
    setEdited((previous) => (previous.has(field) ? previous : new Set(previous).add(field)));
    setOwn((previous) => {
      if (!(field in previous)) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  /**
   * Проверка поля, когда человек перешёл к следующему полю. Только к полю:
   * если фокус ушёл на кнопку (или никуда — Safari не фокусирует кнопки по
   * клику), появившаяся ошибка сдвинула бы кнопку под пальцем между
   * нажатием и отпусканием, и клик пропал бы. Отправку проверяет guard.
   */
  function check(event: FocusEvent<HTMLInputElement>, field: F, problem: string | null) {
    const next = event.relatedTarget;
    if (!(next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement)) return;
    setOwn((previous) => {
      const updated = { ...previous };
      if (problem) updated[field] = problem;
      else delete updated[field];
      return updated;
    });
  }

  /** onSubmit: заведомо неверное не уходит на сервер, фокус — на первую ошибку. */
  function guard(event: FormEvent<HTMLFormElement>, problems: FieldErrors<F>) {
    if (!hasErrors(problems)) {
      setOwn({});
      return;
    }
    event.preventDefault();
    setOwn(problems);
    const first = order.find((field) => problems[field]);
    if (first) document.getElementById(first)?.focus();
  }

  return { errorOf, clear, check, guard, alertRef };
}
