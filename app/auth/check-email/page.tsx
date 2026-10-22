import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ResendForm } from "@/components/auth/resend-form";
import { Icon } from "@/components/ui/icon";
import { PENDING_EMAIL_COOKIE, readPendingEmail } from "@/lib/auth/pending-email";

export const metadata: Metadata = { title: "Проверь почту" };

/**
 * После регистрации, повторного письма и «Забыли пароль?».
 *
 * Адрес берётся из httpOnly-cookie, а не из адресной строки. Текст один и
 * тот же, есть ли аккаунт с этой почтой: он не подтверждает и не отрицает,
 * что адрес зарегистрирован.
 */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const reset = params.reason === "reset";
  const email = readPendingEmail((await cookies()).get(PENDING_EMAIL_COOKIE)?.value);

  return (
    <>
      <span className="mb-6 flex size-12 items-center justify-center rounded-full bg-sunken text-ink-soft">
        <Icon name="send" size={22} />
      </span>
      <h1 className="mb-2 text-[24px] font-semibold">Проверь почту</h1>

      {reset ? (
        <p className="text-[15px] leading-[1.5] text-ink-soft">
          Если есть аккаунт с почтой{" "}
          {email ? <span className="break-all text-ink">{email}</span> : "из формы"}, на неё пришло письмо со
          ссылкой. Перейди по ней и задай новый пароль. Ссылка действует час и только один раз.
        </p>
      ) : (
        <p className="text-[15px] leading-[1.5] text-ink-soft">
          Мы отправили письмо со ссылкой{" "}
          {email ? (
            <>
              на <span className="break-all text-ink">{email}</span>
            </>
          ) : (
            "на твой адрес"
          )}
          . Перейди по ней, чтобы подтвердить почту, — и сразу окажешься в приложении.
        </p>
      )}

      <p className="mt-4 text-[14px] leading-[1.5] text-ink-soft">
        Письма нет несколько минут — загляни в спам.
        {reset
          ? null
          : " Если аккаунт с этой почтой уже есть, письма не будет — войди или восстанови пароль."}
      </p>

      <div className="mt-8 space-y-4">
        {reset ? (
          <Link
            href="/auth/forgot"
            className="inline-block text-[15px] text-signal underline underline-offset-2"
          >
            Запросить письмо ещё раз
          </Link>
        ) : (
          <ResendForm knownEmail={Boolean(email)} />
        )}
        <p>
          <Link
            href="/auth/login"
            className="inline-block text-[15px] text-signal underline underline-offset-2"
          >
            Вернуться ко входу
          </Link>
        </p>
      </div>
    </>
  );
}
