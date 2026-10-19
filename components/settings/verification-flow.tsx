"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { Verified } from "@/components/ui/verified";
import type { UserView } from "@/lib/types";

/**
 * Верификация личности.
 *
 * Добровольная и без выгоды: отметка рядом с ником и ничего больше. Здесь это
 * сказано прямо, потому что иначе проверку проходят в надежде на приоритет,
 * которого в продукте нет.
 *
 * Содержимое экрана — настоящая последовательность из трёх шагов, поэтому
 * нумерованный список уместен. Но рамок у шагов нет: номер в залитом кружке,
 * между шагами — вертикальная линия, остальное лежит на фоне.
 */

const fileInput =
  "w-full rounded-field bg-sunken px-3.5 py-2.5 text-[14px] text-ink-soft " +
  "outline-none transition-shadow focus:ring-2 focus:ring-signal/35 " +
  "file:mr-3 file:rounded-pill file:bg-paper file:px-3 file:py-1.5 file:text-[13px] file:text-ink";

const FIELD_IDS = {
  document: "verification-document",
  selfie: "verification-selfie",
} as const;

type Status = "idle" | "pending";

export function VerificationFlow({ user }: { user: UserView }) {
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [selfieName, setSelfieName] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  if (user.is_verified) {
    return <AlreadyVerified nickname={user.nickname} />;
  }

  if (status === "pending") {
    return <PendingPanel onBack={() => setStatus("idle")} />;
  }

  const ready = documentName !== null && selfieName !== null;

  function pick(event: ChangeEvent<HTMLInputElement>, set: (name: string | null) => void) {
    const file = event.target.files?.[0];
    set(file ? file.name : null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    // TODO(supabase): insert into verification_requests, затем создать сессию у провайдера проверки
    setStatus("pending");
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pt-5">
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
          <Step number={1} title="Фото документа">
            <p className="text-[15px] leading-[1.4] text-ink-soft">
              Студенческий билет, удостоверение личности или паспорт — страница с фотографией и
              именем. Главное, чтобы текст читался.
            </p>

            <div className="mt-3">
              <label
                htmlFor={FIELD_IDS.document}
                className="block pb-1.5 text-[13px] font-medium text-ink"
              >
                Файл с документом
              </label>
              <input
                id={FIELD_IDS.document}
                type="file"
                accept="image/*"
                className={fileInput}
                onChange={(event) => pick(event, setDocumentName)}
              />
              <ChosenFile name={documentName} />
            </div>
          </Step>

          <Step number={2} title="Селфи">
            <p className="text-[15px] leading-[1.4] text-ink-soft">
              Обычное фото лица при нормальном свете. Провайдер сверяет его с фотографией в
              документе — больше ни для чего оно не нужно.
            </p>

            <div className="mt-3">
              <label
                htmlFor={FIELD_IDS.selfie}
                className="block pb-1.5 text-[13px] font-medium text-ink"
              >
                Файл с селфи
              </label>
              <input
                id={FIELD_IDS.selfie}
                type="file"
                accept="image/*"
                className={fileInput}
                onChange={(event) => pick(event, setSelfieName)}
              />
              <ChosenFile name={selfieName} />
            </div>
          </Step>

          <Step number={3} title="Проверка">
            <p className="text-[15px] leading-[1.4] text-ink-soft">
              Сравнение делает внешний провайдер — Stripe Identity или Onfido, выбор ещё не
              сделан, и ни один из них пока не подключён. Обычно это занимает несколько минут,
              иногда до суток. Ответ придёт в уведомления.
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
              Фото уходит провайдеру проверки, а не в To Get There. Приложение получает только
              ответ «да» или «нет» и сами файлы не хранит.
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
              Сроки хранения у провайдера появятся здесь, когда провайдер будет выбран. До этого
              обещать за него нечего.
            </span>
          </li>
        </ul>

        <p className="mt-5 rounded-card bg-sunken p-3.5 text-[14px] leading-[1.4] text-ink-soft">
          Сейчас за формой нет ни хранилища, ни провайдера. Выбранные файлы остаются на твоём
          устройстве: никуда не загружаются и никуда не отправляются.
        </p>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 -mb-24 mt-7 border-t border-line bg-paper/95 px-4 backdrop-blur-sm md:-mb-10">
        <div className="u-safe-b pt-3">
          <div className="pb-[4.25rem] md:pb-3">
            {!ready ? (
              <p className="pb-2 text-center text-[12px] text-ink-faint">
                Выбери оба файла — документ и селфи.
              </p>
            ) : null}

            <Button type="submit" size="lg" full disabled={!ready}>
              Отправить на проверку
            </Button>
          </div>
        </div>
      </div>
    </form>
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

/** Имя выбранного файла — и честная подпись, что он ещё никуда не ушёл. */
function ChosenFile({ name }: { name: string | null }) {
  if (!name) return null;

  return (
    <p className="mt-2 flex items-start gap-2 text-[14px] leading-[1.4] text-ink-soft">
      <Icon name="image" size={15} className="mt-0.5 shrink-0 text-ink-faint" />
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{name}</span>
        <span className="block">Выбран на твоём устройстве, не загружен.</span>
      </span>
    </p>
  );
}

function PendingPanel({ onBack }: { onBack: () => void }) {
  return (
    <section className="u-rise px-4 pt-6 pb-10">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-soft">
          <Icon name="clock" size={21} />
        </span>
        <h2 className="text-[17px] font-medium">Заявка на проверке</h2>
      </div>

      <div className="mt-5 space-y-3 text-[15px] leading-[1.4] text-ink-soft">
        <p>
          <span className="font-medium text-ink">Что будет дальше.</span> Провайдер сверит фото в
          документе с селфи. Обычно это несколько минут, иногда до суток. Ответ придёт в
          уведомления, и при положительном рядом с ником появится отметка «Личность
          подтверждена».
        </p>
        <p>
          Если проверка не пройдёт, в уведомлении будет написано, что именно не сошлось, и можно
          будет отправить файлы заново.
        </p>
      </div>

      <p className="mt-5 rounded-card bg-sunken p-3.5 text-[14px] leading-[1.4] text-ink-soft">
        Так этот экран будет выглядеть с подключённым провайдером. Пока ничего не отправлено:
        хранилища и провайдера за формой нет, файлы остались на твоём устройстве.
      </p>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <Button type="button" variant="quiet" size="lg" full onClick={onBack}>
          Вернуться к форме
        </Button>
        <ButtonLink href="/settings" variant="quiet" size="lg" full>
          К настройкам
        </ButtonLink>
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
