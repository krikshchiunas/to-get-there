import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { signUp } from "../actions";

export const metadata: Metadata = { title: "Регистрация" };

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-semibold">Регистрация</h1>
      <p className="mb-8 text-[15px] leading-[1.4] text-ink-soft">
        Почта и пароль — и всё. Ник придумаем из адреса, поменяешь в настройках. Почта на домене вуза из
        списка сама откроет ленту твоего университета.
      </p>
      <AuthForm mode="signup" action={signUp} />
    </>
  );
}
