import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { Verified } from "@/components/ui/verified";
import { listLead, listRow, verifiedSize } from "@/components/ui/list-row";
import type { UserView } from "@/lib/types";
import { FollowButton } from "./follow-button";

/**
 * One person in a list: the follows page and the people results in search.
 * Takes nothing but the user, so any screen with a `UserView` can use it.
 *
 * Строка человека повторяет эталонную строку ленты: аватар-якорь 40px слева,
 * содержимое справа, снизу линия во всю ширину колонки. Вуз и факультет —
 * одна служебная строка, а не два уровня серого друг под другом. Вся строка
 * ведёт в профиль через растянутую ссылку на нике, поэтому кнопка подписки
 * поднята над ней и остаётся отдельной целью.
 */
export function UserRow({ user, viewerId }: { user: UserView; viewerId: string }) {
  const isViewer = user.id === viewerId;
  const place = user.faculty ? `${user.university.short_name} · ${user.faculty}` : user.university.short_name;

  return (
    <div className={`${listRow} items-center`}>
      <span className={listLead}>
        <Avatar user={user} size="md" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/u/${user.nickname}`}
            className="block min-w-0 truncate text-[15px] font-medium after:absolute after:inset-0"
          >
            {user.nickname}
          </Link>
          {user.is_verified ? <Verified size={verifiedSize} className="shrink-0" /> : null}
        </div>
        <p className="truncate text-[14px] text-ink-soft">{place}</p>
      </div>

      {isViewer ? (
        <Pill>Это ты</Pill>
      ) : (
        <span className="relative z-10 shrink-0">
          <FollowButton user={user} size="sm" />
        </span>
      )}
    </div>
  );
}
