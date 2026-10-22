import { SessionSync } from "@/components/auth/session-sync";
import { Nav } from "@/components/nav/bottom-nav";
import { ToastHost } from "@/components/ui/toast";
import { LiveRefresh } from "@/lib/live";
import { getUnreadDirectTotal, getUnreadNotificationCount, getViewer } from "@/lib/data";

/**
 * Оболочка приложения: навигация и колонка. Живёт в группе (app), а не в
 * корневом макете, потому что ей нужен зритель — а на экранах входа его ещё
 * нет. Корневой макет, читающий зрителя, отправлял бы /auth/login обратно
 * на /auth/login.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [viewer, unreadChats, unreadNotifications] = await Promise.all([
    getViewer(),
    getUnreadDirectTotal(),
    getUnreadNotificationCount(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[48rem]">
      {/* WCAG 2.4.1: с клавиатуры — сразу к содержанию, мимо навигации. */}
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-pill focus:bg-signal focus:px-4 focus:py-2 focus:text-[15px] focus:text-signal-ink"
      >
        Перейти к содержанию
      </a>
      <Nav
        unreadChats={unreadChats}
        unreadNotifications={unreadNotifications}
        profileNickname={viewer.nickname}
      />
      <div className="min-w-0 flex-1 border-line md:border-r">
        {/* Место под фиксированную нижнюю панель на телефоне. */}
        <main id="content" tabIndex={-1} className="u-column pb-24 outline-none md:pb-10">
          {children}
        </main>
      </div>
      <ToastHost />
      {/* Личка и уведомления: бейджи и списки обновляются сами. */}
      <LiveRefresh topic={`user:${viewer.id}`} />
      {/* Выход в другой вкладке — эта тоже уходит на вход. */}
      <SessionSync />
    </div>
  );
}
