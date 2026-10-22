"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { IconName } from "@/lib/types";
import { Icon } from "@/components/ui/icon";

type Item = { href: string; label: string; icon: IconName; badge?: number };

/**
 * Primary navigation. A bar along the bottom on phones — thumbs live there —
 * and a vertical rail from `md` up. Creating an idea is the one filled
 * control, because it is the thing the product exists for.
 */
export function Nav({
  unreadChats = 0,
  unreadNotifications = 0,
  profileNickname,
}: {
  unreadChats?: number;
  unreadNotifications?: number;
  profileNickname: string;
}) {
  const pathname = usePathname();
  // Нажатую вкладку подсвечиваем сразу, ещё до ответа сервера: палец видит
  // отклик за кадр, а не через сетевой круг. Как только адрес сменился,
  // подсветка снова следует за ним. onNavigate — только настоящий переход
  // внутри приложения: не Cmd-клик и не «открыть в новой вкладке».
  const [tapped, setTapped] = useState<{ from: string; href: string } | null>(null);
  const shown = tapped && tapped.from === pathname ? tapped.href : pathname;
  const tap = (href: string) => () => setTapped({ from: pathname, href });

  const items: Item[] = [
    { href: "/", label: "Идеи", icon: "feed" },
    { href: "/search", label: "Поиск", icon: "search" },
    { href: "/messages", label: "Чаты", icon: "chat", badge: unreadChats },
    { href: `/u/${profileNickname}`, label: "Профиль", icon: "person" },
  ];

  const railExtras: Item[] = [
    { href: "/notifications", label: "Уведомления", icon: "bell", badge: unreadNotifications },
    { href: "/settings", label: "Настройки", icon: "settings" },
  ];

  const matches = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  // Подсветка — куда идём; aria-current — где на самом деле.
  const state = (href: string) => ({
    active: matches(shown, href),
    current: matches(pathname, href),
    onNavigate: tap(href),
  });

  return (
    <>
      {/* Phones: fixed bar, create button in the middle. */}
      <nav
        aria-label="Основная навигация"
        className="u-safe-b fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur-sm md:hidden"
      >
        <ul className="mx-auto flex max-w-[34rem] items-stretch justify-between px-2">
          {items.slice(0, 2).map((item) => (
            <li key={item.href} className="flex-1">
              <NavTab item={item} {...state(item.href)} />
            </li>
          ))}

          <li className="flex items-center px-1">
            <Link
              href="/create"
              aria-label="Создать идею"
              className="flex size-11 items-center justify-center rounded-full bg-signal text-signal-ink"
            >
              <Icon name="plus" size={22} />
            </Link>
          </li>

          {items.slice(2).map((item) => (
            <li key={item.href} className="flex-1">
              <NavTab item={item} {...state(item.href)} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Tablet and up: a rail beside the column. */}
      <nav
        aria-label="Основная навигация"
        className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 border-r border-line px-3 py-5 md:flex md:w-[13.5rem]"
      >
        <Link href="/" className="mb-5 px-3 text-[18px] leading-tight font-semibold">
          To Get
          <br />
          There
        </Link>

        {items.map((item) => (
          <NavRow key={item.href} item={item} {...state(item.href)} />
        ))}

        <Link
          href="/create"
          className="mt-3 flex items-center justify-center gap-2 rounded-pill bg-signal px-4 py-2.5 text-sm font-medium text-signal-ink"
        >
          <Icon name="plus" size={17} />
          Создать идею
        </Link>

        <div className="mt-auto space-y-1">
          {railExtras.map((item) => (
            <NavRow key={item.href} item={item} {...state(item.href)} />
          ))}
        </div>
      </nav>
    </>
  );
}

type TabState = { active: boolean; current: boolean; onNavigate: () => void };

function NavTab({ item, active, current, onNavigate }: { item: Item } & TabState) {
  return (
    <Link
      href={item.href}
      onNavigate={onNavigate}
      aria-current={current ? "page" : undefined}
      className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${
        active ? "text-signal" : "text-ink-faint"
      }`}
    >
      <span className="relative">
        <Icon name={item.icon} size={22} />
        {item.badge ? <Dot /> : null}
      </span>
      {item.label}
      {item.badge ? <span className="sr-only">, непрочитанных: {item.badge}</span> : null}
    </Link>
  );
}

function NavRow({ item, active, current, onNavigate }: { item: Item } & TabState) {
  return (
    <Link
      href={item.href}
      onNavigate={onNavigate}
      aria-current={current ? "page" : undefined}
      className={`flex items-center gap-3 rounded-pill px-3 py-2.5 text-[15px] font-medium transition-colors ${
        active ? "bg-signal-wash text-signal" : "text-ink-soft hover:bg-sunken hover:text-ink"
      }`}
    >
      <span className="relative">
        <Icon name={item.icon} size={20} />
        {item.badge ? <Dot /> : null}
      </span>
      {item.label}
      {item.badge ? <span className="sr-only">, непрочитанных: {item.badge}</span> : null}
    </Link>
  );
}

/** Только для глаз: число для скринридера стоит рядом с подписью. */
function Dot() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-heat ring-2 ring-paper"
    />
  );
}
