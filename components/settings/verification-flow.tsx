"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { startVerification } from "@/app/actions/verification";
import { notify } from "@/components/ui/toast";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { Verified } from "@/components/ui/verified";
import type { VerificationState } from "@/lib/data/verification";
import { explainVerificationError } from "@/lib/verification-text";
import type { UserView } from "@/lib/types";

/**
 * Верификация личности.
 *
 * Добровольная и без выгоды: отметка рядом с ником и ничего больше. Здесь это
 * сказано прямо, потому что иначе проверку проходят в надежде на приоритет,
 * которого в продукте нет.
 *
 * Документы собирает Stripe Identity на своей странице; приложение получает
 * только итог вебхуком (app/api/webhooks/stripe) и файлов не хранит.
 *
 * Содержимое экрана — настоящая последовательность из трёх шагов, поэтому
 * нумерованный список уместен. Но рамок у шагов нет: номер в залитом кружке,
 * между шагами — вертикальная линия, остальное лежит на фоне.
 */

type Props = {
  user: UserView;
  /** Последняя заявка; null — ещё не пробовал. */
  state: VerificationState | null;
  /** Подключён ли провайдер на сервере (lib/stripe-identity → identityConfigured). */
  available: boolean;
  /** Человек только что вернулся со страницы провайдера. */
  returned: boolean;
};

export function VerificationFlow({ user, state, available, returned }: Props) {
  const [starting, startTransition] = useTransition();
  const [restart, setRestart] = useState(false);

  if (user.is_verified || state?.status === "verified") {
    return <AlreadyVerified nickname={user.nickname} />;
  }

  // Вернулся от провайдера, а вебхук ещё не пришёл, — или ответ уже в пути.
  const waiting = state?.status === "processing" || (returned && state?.status === "pending");
  if (waiting && !restart) {
    return <PendingPanel onRestart={() => setRestart(true)} />;
  }

  function begin() {
    startTransition(async () => {
      const result = await startVerification();
      if (!result.ok) {
        notify(result.error);
        return;
      }
      if (result.data) window.location.assign(result.data.url);
    });
  }

  const failed = state?.status === "requires_input";

  return (
    <div className="px-4 pt-5">
      {failed ? (
        <section className="mb-8 rounded-card bg-sunken p-3.5" role="status">
          <h2 className="text-[15px] font-medium">Прошлая проверка не прошла</h2>
          <p className="mt-1 text-[14px] leading-[1.4] text-ink-soft">
            {explainVerificationError(state?.errorCode ?? null)}
          </p>
        </section>
      ) : null}

      {/* Здесь нарочно не настоящая отметка: у неё доступное имя «Личность
          подтверждена», а личность ещё не подтверждена. */}
      <section>
        <h2 className="text-[13px] font-medium text-ink-faint">Что это даёт</h2>
        <p className="mt-2 text-[15px] leading-[1.4] text-ink-soft">
          Рядом с твоим ником появится отметка «Личность подтверждена». Это всё, что происходит.
        </p>

        <h3 className="mt-6 text-[13px] font-medium text-ink-faint">И чего не даёт</h3>
        <p className="mt-2 text-[15px] leading-[1.4] text-ink-soft">
          Ни приоритета в поиске, ни отдельного фильтра, ни доступа в закрытые чаты, ни к
          профилям, которые от тебя скрыты. Проверка добровольная: без неё в приложении доступно
          ровно то же самое.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-medium text-ink-faint">Как это работает</h2>

        <ol className="mt-4">
          <Step number={1} title="Переход к провайдеру">
            <p className="text-[15px] leading-[1.4] text-ink-soft">
              Кнопка ниже откроет страницу Stripe Identity — сервиса, который проверяет документы
              для банков и маркетплейсов.
            </p>
          </Step>

          <Step number={2} title="Документ и селфи">
            <p className="text-[15px] leading-[1.4] text-ink-soft">
              Паспорт, ID-карта или водительские права — и селфи с камеры. Stripe сверяет лицо с
              фотографией в документе. С телефона удобнее всего.
            </p>
          </Step>

          <Step number={3} title="Ответ">
            <p className="text-[15px] leading-[1.4] text-ink-soft">
              Обычно несколько минут, иногда дольше. Ответ придёт в уведомления, а отметка
              появится сама.
            </p>
          </Step>
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-medium text-ink-faint">Что происходит с документами</h2>

        <ul className="mt-3 space-y-3 text-[15px] leading-[1.4] text-ink-soft">
          <li className="flex gap-2.5">
            <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-ink-faint" />
            <span>
              Фото документа и селфи ты показываешь Stripe на его странице. В To Get There они не
              попадают: приложение получает только ответ «да» или «нет» и, если нет, — причину.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Icon name="lock" size={16} className="mt-0.5 shrink-0 text-ink-faint" />
            <span>
              Другие студенты видят только отметку рядом с ником. Ни документ, ни селфи, ни имя
              из документа не показываются никому.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Icon name="close" size={16} className="mt-0.5 shrink-0 text-ink-faint" />
            <span>
              Сколько Stripe хранит данные проверки, описано в его{" "}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-signal underline underline-offset-2"
              >
                политике конфиденциальности
              </a>
              .
            </span>
          </li>
        </ul>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 -mb-24 mt-7 border-t border-line bg-paper/95 px-4 backdrop-blur-sm md:-mb-10">
        <div className="u-safe-b pt-3">
          <div className="pb-[4.25rem] md:pb-3">
            {!available ? (
              <p className="pb-2 text-center text-[12px] text-ink-faint">
                Проверка ещё не подключена. Всё остальное в приложении работает без неё.
              </p>
            ) : null}

            <Button type="button" size="lg" full disabled={!available || starting} onClick={begin}>
              {starting ? "Открываем Stripe…" : failed ? "Попробовать ещё раз" : "Пройти проверку"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Шаг последовательности: номер в залитом кружке, содержимое справа,
 * вертикальная линия до следующего шага. У последнего шага линии нет.
 */
function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li
      className={[
        "relative flex gap-3.5 pb-7 last:pb-0",
        "after:absolute after:top-11 after:bottom-2 after:left-[17px]",
        "after:border-l after:border-line last:after:hidden",
      ].join(" ")}
    >
      <span
        aria-hidden
        className="u-display u-tnum flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-[15px] text-ink-soft"
      >
        {number}
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-medium">{title}</h3>
        <div className="mt-1.5">{children}</div>
      </div>
    </li>
  );
}

function PendingPanel({ onRestart }: { onRestart: () => void }) {
  return (
    <section className="u-rise px-4 pt-6 pb-10" role="status">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-soft">
          <Icon name="clock" size={21} />
        </span>
        <h2 className="text-[17px] font-medium">Заявка на проверке</h2>
      </div>

      <div className="mt-5 space-y-3 text-[15px] leading-[1.4] text-ink-soft">
        <p>
          <span className="font-medium text-ink">Что будет дальше.</span> Stripe сверит фото в
          документе с селфи. Обычно это несколько минут, иногда дольше. Ответ придёт в
          уведомления, и при положительном рядом с ником появится отметка «Личность
          подтверждена».
        </p>
        <p>
          Если проверка не пройдёт, здесь будет написано, что именно не сошлось, и можно будет
          попробовать снова.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <ButtonLink href="/settings" variant="quiet" size="lg" full>
          К настройкам
        </ButtonLink>
        <Button type="button" variant="quiet" size="lg" full onClick={onRestart}>
          Не закончил — начать заново
        </Button>
      </div>
    </section>
  );
}

function AlreadyVerified({ nickname }: { nickname: string }) {
  return (
    <section className="px-4 pt-6 pb-10">
      <div className="flex items-center gap-2.5">
        <Verified size={22} />
        <h2 className="text-[17px] font-medium">Личность подтверждена</h2>
      </div>

      <p className="mt-3 text-[15px] leading-[1.4] text-ink-soft">
        Рядом с ником {nickname} стоит отметка. Привилегий она не даёт: ни в поиске, ни в чатах,
        ни в фильтрах — только показывает другим студентам, что человека проверили.
      </p>

      <div className="mt-4">
        <Pill tone="verified" icon="check">
          Проверка пройдена
        </Pill>
      </div>

      <div className="mt-7">
        <ButtonLink href="/settings" variant="quiet" size="lg" full>
          К настройкам
        </ButtonLink>
      </div>
    </section>
  );
}
