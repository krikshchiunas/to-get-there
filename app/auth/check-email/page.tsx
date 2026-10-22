import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { EmailForm } from "@/components/auth/email-form";
import { Icon } from "@/components/ui/icon";
import { resendConfirmation } from "@/app/auth/actions";
import { checkEmail, normalizeEmail } from "@/lib/auth/credentials";
import { PENDING_EMAIL_COOKIE } from "@/lib/auth/pending-email";

export const metadata: Metadata = { title: "Проверь почту" };

/**
 * «Проверь почту» после регистрации и после «Забыли пароль?».
 *
 * Адрес — из httpOnly cookie (lib/auth/pending-email.ts), не из строки
 * запроса. Текст один и тот же, есть аккаунт или нет: «если адрес верный —
 * письмо в пути», а не «мы отправили», — иначе экран отвечал бы, кто
 * зарегистрирован.
 */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const reset = params.reason === "reset";
  const remembered = normalizeEmail((await cookies()).get(PENDING_EMAIL_COOKIE)?.value);
  const email = remembered && !checkEmail(remembered) ? remembered : null;

  return (
    <>
      <span className="mb-6 flex size-12 items-center justify-center rounded-full bg-sunken text-ink-soft">
        <Icon name="send" size={22} />
      </span>
      <h1 className="mb-2 text-[24px] font-semibold">Проверь почту</h1>
      <p className="text-[15px] leading-[1.5] text-ink-soft">
        {reset ? "Если есть аккаунт с почтой " : "Если адрес "}
        {email ? <span className="text-ink">{email}</span> : "указан верно"}
        {reset
          ? ", на неё пришло письмо со ссылкой. Перейди по ней и задай новый пароль."
          : email
            ? " указан верно, на него пришло письмо. Перейди по ссылке в нём — и сразу окажешься в приложении."
            : ", на него пришло письмо. Перейди по ссылке в нём — и сразу окажешься в приложении."}
      </p>
      <p className="mt-4 text-[14px] leading-[1.5] text-ink-soft">
        Письма нет несколько минут — загляни в спам. Ссылка действует один раз
        {reset ? " — открой её в этом же браузере" : ""}.
      </p>

      {reset ? null : (
        <section aria-labelledby="resend-heading" className="mt-8">
          <h2 id="resend-heading" className="mb-3 text-[15px] font-medium">
            Письмо не пришло?
          </h2>
          <EmailForm
            id="resend"
            action={resendConfirmation}
            initialEmail={email ?? ""}
            submitLabel="Отправить ещё раз"
            pendingLabel="Отправляем…"
            sentText="Если аккаунт с этой почтой ждёт подтверждения, письмо отправлено ещё раз."
          />
        </section>
      )}

      <Link
        href="/auth/login"
        className="mt-8 inline-block text-[15px] text-signal underline underline-offset-2"
      >
        Вернуться ко входу
      </Link>
    </>
  );
}
