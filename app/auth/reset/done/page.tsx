import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Пароль обновлён" };

/**
 * Отдельная страница, а не состояние формы: действие меняет cookie сессии,
 * Next перерисовывает /auth/reset, и метки восстановления там уже нет —
 * вместо «готово» человек увидел бы «ссылка устарела».
 */
export default function PasswordUpdatedPage() {
  return (
    <>
      <span className="mb-6 flex size-12 items-center justify-center rounded-full bg-sunken text-ink-soft">
        <Icon name="check" size={22} />
      </span>
      <h1 className="mb-2 text-[24px] font-semibold">Пароль обновлён</h1>
      <p className="mb-8 text-[15px] leading-[1.5] text-ink-soft">
        Ты уже внутри. Со следующего раза входи с новым паролем — старый больше не подходит.
      </p>
      <ButtonLink href="/" size="lg" full>
        В приложение
      </ButtonLink>
    </>
  );
}
