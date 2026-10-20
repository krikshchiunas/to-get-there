import Link from "next/link";
import { initialsOf } from "@/lib/format";
import { Verified } from "./verified";

/**
 * Avatars render as initials on a tint derived from the user id. The tint is
 * mixed into the surface colour, so the same code works in both themes and
 * needs no network request while the app runs on mock data.
 */
const tints = ["#2f3bee", "#e8275a", "#1a7f64", "#6c4bf0", "#e0922a"];

const sizes = {
  xs: { box: 24, text: "text-[10px]", badge: 10 },
  sm: { box: 32, text: "text-[12px]", badge: 12 },
  md: { box: 40, text: "text-[14px]", badge: 14 },
  lg: { box: 56, text: "text-[18px]", badge: 18 },
  xl: { box: 88, text: "text-[28px]", badge: 24 },
} as const;

export type AvatarSize = keyof typeof sizes;

function tintFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 997;
  return tints[hash % tints.length];
}

export interface AvatarProps {
  user: { id: string; nickname: string; avatar_url: string | null; is_verified?: boolean };
  size?: AvatarSize;
  /** Shows the verification badge in the corner. */
  withBadge?: boolean;
  className?: string;
}

export function Avatar({ user, size = "md", withBadge = false, className = "" }: AvatarProps) {
  const spec = sizes[size];
  const tint = tintFor(user.id);

  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: spec.box, height: spec.box }}
    >
      {user.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- mock + Storage URLs, sized by the span
        <img
          src={user.avatar_url}
          alt=""
          width={spec.box}
          height={spec.box}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className={`flex h-full w-full items-center justify-center rounded-full font-medium ${spec.text}`}
          style={{
            background: `color-mix(in oklab, ${tint} 20%, var(--c-surface))`,
            // 55%: инициалы читаются на заливке не хуже 5.5:1 в обеих темах (WCAG AA).
            color: `color-mix(in oklab, ${tint} 55%, var(--c-ink))`,
            // Кольцо, а не тень: теней в приложении нет ни одной.
            outline: "1px solid color-mix(in oklab, currentColor 16%, transparent)",
            outlineOffset: "-1px",
          }}
        >
          {initialsOf(user.nickname)}
        </span>
      )}

      {withBadge && user.is_verified ? (
        <span className="absolute -right-0.5 -bottom-0.5 rounded-full bg-paper p-px">
          <Verified size={spec.badge} />
        </span>
      ) : null}
    </span>
  );
}

/** Avatar that links to the profile. Used in cards, chat and lists. */
/**
 * Аватар, по которому можно нажать. Рядом с ним всегда есть ник — ссылка на
 * тот же профиль, — поэтому для клавиатуры и экранных читалок аватар —
 * декоративный дубль: вне порядка Tab и вне дерева доступности. Иначе
 * каждая строка чата давала бы две одинаковые остановки, а видимые
 * инициалы не совпадали бы с именем ссылки (WCAG 2.5.3).
 */
export function AvatarLink({ user, size, withBadge, className }: AvatarProps) {
  return (
    <Link href={`/u/${user.nickname}`} aria-hidden tabIndex={-1} className="rounded-full">
      <Avatar user={user} size={size} withBadge={withBadge} className={className} />
    </Link>
  );
}

/** Overlapping faces, e.g. who is already in a chat. */
export function AvatarStack({
  users,
  max = 4,
  size = "xs",
}: {
  users: Array<{ id: string; nickname: string; avatar_url: string | null }>;
  max?: number;
  size?: AvatarSize;
}) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;

  return (
    <span className="flex items-center">
      {shown.map((user, index) => (
        <span key={user.id} className={index === 0 ? "" : "-ml-1.5"} style={{ zIndex: shown.length - index }}>
          <Avatar user={user} size={size} className="ring-2 ring-paper rounded-full" />
        </span>
      ))}
      {rest > 0 ? <span className="u-tnum ml-1.5 text-xs text-ink-faint">+{rest}</span> : null}
    </span>
  );
}
