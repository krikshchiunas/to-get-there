import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const notice =
    params.error === "link"
      ? "Ссылка из письма недействительна или уже использована. Если почта уже подтверждена — просто войди; если нет — войди, и мы предложим отправить письмо ещё раз."
      : params.confirmed
        ? "Почта подтверждена. Теперь войди."
        : params.deleted
          ? "Аккаунт удалён вместе со всеми данными. Если захочешь вернуться — регистрация по той же почте."
          : params.signed_out
            ? "Ты вышел из аккаунта на этом устройстве."
            : null;

  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-semibold">Вход</h1>
      <p className="mb-8 text-[15px] leading-[1.4] text-ink-soft">
        Идеи, чаты и люди из твоего университета.
      </p>
      <AuthForm mode="login" action={signIn} next={next} notice={notice} />
    </>
  );
}
