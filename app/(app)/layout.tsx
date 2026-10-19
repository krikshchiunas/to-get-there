import { Nav } from "@/components/nav/bottom-nav";
import { ToastHost } from "@/components/ui/toast";
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
      <Nav
        unreadChats={unreadChats}
        unreadNotifications={unreadNotifications}
        profileNickname={viewer.nickname}
      />
      <div className="min-w-0 flex-1 border-line md:border-r">
        {/* Место под фиксированную нижнюю панель на телефоне. */}
        <main className="u-column pb-24 md:pb-10">{children}</main>
      </div>
      <ToastHost />
    </div>
  );
}
