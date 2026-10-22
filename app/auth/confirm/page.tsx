import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/auth/submit-button";
import { Icon } from "@/components/ui/icon";
import { confirmEmailLink } from "@/app/auth/actions";
import { emailLinkType, plausibleTokenHash } from "@/lib/auth/email-link";

export const metadata: Metadata = { title: "Ссылка из письма" };

/**
 * Ссылка из письма с token_hash — работает на любом устройстве.
 *
 * Сама страница ничего не меняет: вход — по кнопке, серверным действием
 * confirmEmailLink (app/auth/actions.ts). Так одноразовую ссылку не сожжёт
 * почтовый сканер, открывающий ссылки для проверки, и её нельзя «скормить»
 * человеку, чтобы он молча оказался в чужом аккаунте. Чтобы письма вели
 * сюда, шаблоны Supabase — в docs/AUTH.md, «Настройки Supabase».
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const type = emailLinkType(params.type);
  const tokenHash = params.token_hash;
  const recovery = type === "recovery";

  if (!plausibleTokenHash(tokenHash)) {
    return (
      <>
        <h1 className="mb-2 text-[24px] font-semibold">Ссылка неполная</h1>
        <p className="text-[15px] leading-[1.5] text-ink-soft">
          Похоже, адрес скопировался не целиком. Открой ссылку из письма ещё раз или запроси новую.
        </p>
        <Link
          href={recovery ? "/auth/forgot" : "/auth/login"}
          className="mt-8 inline-block text-[15px] text-signal underline underline-offset-2"
        >
          {recovery ? "Запросить новое письмо" : "Ко входу"}
        </Link>
      </>
    );
  }

  return (
    <>
      <span className="mb-6 flex size-12 items-center justify-center rounded-full bg-sunken text-ink-soft">
        <Icon name={recovery ? "lock" : "check"} size={22} />
      </span>
      <h1 className="mb-2 text-[24px] font-semibold">{recovery ? "Новый пароль" : "Подтверждение почты"}</h1>
      <p className="mb-8 text-[15px] leading-[1.5] text-ink-soft">
        {recovery
          ? "Нажми кнопку — и задай новый пароль. Ссылка сработает один раз."
          : "Нажми кнопку — почта подтвердится, и ты окажешься в приложении."}{" "}
        Кнопка нужна потому, что почтовые сервисы иногда сами открывают ссылки из писем, проверяя их, — и
        одноразовая ссылка сгорела бы раньше тебя.
      </p>
      <form action={confirmEmailLink}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <SubmitButton
          label={recovery ? "Задать новый пароль" : "Подтвердить почту и войти"}
          pendingLabel="Проверяем ссылку…"
        />
      </form>
    </>
  );
}
