import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { AnnounceSignedOut } from "@/components/auth/session-sync";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Вход" };

type Params = Record<string, string | string[] | undefined>;

/** Почему человек оказался на входе — одна строка над формой. */
function noticeFor(params: Params): string | null {
  if (params.error === "link") {
    return "Ссылка из письма устарела или уже использована. Если почта уже подтверждена — просто войди. Если нет — войди с паролем, и мы предложим отправить письмо ещё раз.";
  }
  if (params.error === "session") return "Не получилось открыть твой аккаунт. Войди ещё раз.";
  if (params.confirmed) return "Почта подтверждена. Теперь войди с паролем.";
  if (params.deleted) {
    return "Аккаунт удалён вместе со всеми данными. Если захочешь вернуться — регистрация по той же почте.";
  }
  if (params.signed_out === "all") return "Ты вышел на всех устройствах.";
  if (params.signed_out) return "Ты вышел из аккаунта.";
  if (params.expired) return "Сессия закончилась. Войди снова — и вернёшься туда, где был.";
  return null;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  // Проверяет сервер при входе (lib/safe-next.ts); здесь — чтобы не нести
  // чужой адрес даже в скрытом поле и в ссылке на регистрацию.
  const raw = typeof params.next === "string" ? params.next : null;
  const next = raw && safeNext(raw) !== "/" ? safeNext(raw) : undefined;

  return (
    <>
      {params.signed_out ? <AnnounceSignedOut /> : null}
      <h1 className="mb-1.5 text-[24px] font-semibold">Вход</h1>
      <p className="mb-8 text-[15px] leading-[1.4] text-ink-soft">
        Идеи, чаты и люди — для тех, кто хочет что-то сделать вместе.
      </p>
      <LoginForm next={next} notice={noticeFor(params)} />
    </>
  );
}
