import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Регистрация" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = typeof params.next === "string" ? params.next : null;
  const next = raw && safeNext(raw) !== "/" ? safeNext(raw) : undefined;

  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-semibold">Регистрация</h1>
      <p className="mb-8 text-[15px] leading-[1.4] text-ink-soft">
        Почта и пароль — и подтверждение по ссылке из письма. Ник дадим случайный, поменяешь в настройках.
      </p>
      <SignupForm next={next} />
    </>
  );
}
