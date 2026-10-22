import type { ReactNode, Ref } from "react";

/**
 * Сообщения формы входа.
 *
 * Ошибка — role="alert": читалка объявит её сразу; tabIndex -1, чтобы на
 * неё можно было перевести фокус (useFormErrors). Пояснение и итог —
 * role="status": объявляются, не перебивая. Место под текст держит сама
 * форма, поэтому появление сообщения не сдвигает поле под пальцем.
 */
export function FormError({
  id,
  children,
  ref,
}: {
  id: string;
  children: ReactNode;
  ref?: Ref<HTMLParagraphElement>;
}) {
  return (
    <p
      ref={ref}
      id={id}
      role="alert"
      tabIndex={-1}
      className="rounded-field bg-heat-wash px-4 py-3 text-[14px] leading-[1.4] text-heat outline-none"
    >
      {children}
    </p>
  );
}

export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-field bg-sunken px-4 py-3 text-[14px] leading-[1.4] text-ink-soft">
      {children}
    </p>
  );
}
