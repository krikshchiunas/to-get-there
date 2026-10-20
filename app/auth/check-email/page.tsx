import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Проверь почту" };

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : null;
  const reset = params.reason === "reset";

  return (
    <>
      <span className="mb-6 flex size-12 items-center justify-center rounded-full bg-sunken text-ink-soft">
        <Icon name="send" size={22} />
      </span>
      <h1 className="mb-2 text-[24px] font-semibold">Проверь почту</h1>
      <p className="text-[15px] leading-[1.5] text-ink-soft">
        {reset ? "Если есть аккаунт с почтой " : "Мы отправили письмо "}
        {email ? <span className="text-ink">{reset ? email : `на ${email}`}</span> : "на твой адрес"}
        {reset
          ? ", на неё пришло письмо со ссылкой. Перейди по ней и задай новый пароль."
          : ". Перейди по ссылке в нём — и сразу окажешься в приложении."}
      </p>
      <p className="mt-4 text-[14px] leading-[1.5] text-ink-soft">
        Письма нет несколько минут — загляни в спам. Ссылка действует один раз
        {reset ? " — открой её в этом же браузере" : ""}.
      </p>
      <Link
        href="/auth/login"
        className="mt-8 inline-block text-[15px] text-signal underline underline-offset-2"
      >
        Вернуться ко входу
      </Link>
    </>
  );
}
