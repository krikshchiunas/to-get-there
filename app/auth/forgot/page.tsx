import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = { title: "Восстановление пароля" };

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const notice =
    params.error === "link"
      ? "Ссылка из письма устарела или уже использована. Запроси новую — она придёт за минуту."
      : params.error === "browser"
        ? "Ссылку открыли не в том браузере, где запрашивали сброс. Запроси письмо ещё раз и открой ссылку на этом устройстве."
        : null;

  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-semibold">Забыли пароль?</h1>
      <p className="mb-8 text-[15px] leading-[1.4] text-ink-soft">
        Напиши почту, с которой регистрировался, — пришлём ссылку, чтобы задать новый пароль.
      </p>
      <ForgotForm notice={notice} />
    </>
  );
}
