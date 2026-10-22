import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Verified } from "@/components/ui/verified";
import { formatCount, pluralRu } from "@/lib/format";
import { canMessage, canSeeInterests, getViewer } from "@/lib/data";
import { isFriend, type UserView } from "@/lib/types";
import { FollowButton } from "./follow-button";
import { BlockedNotice } from "./profile-menu";

/**
 * Identity block of a profile: who this is, where they study, what they are
 * after, and the two things a visitor can do about it — follow, or write.
 * Only rendered when `canSeeProfile(user)` holds; the restricted view lives
 * on the page itself.
 *
 * Снято с шапки профиля в Threads и Bluesky: аватар и ник, под ником одна
 * служебная строка, био, счётчики обычным текстом, и ровно две кнопки в ряд.
 * Ни одной панели с рамкой: всё лежит прямо на фоне, а шапку от списка идей
 * отделяет та же линия, что разделяет элементы ленты.
 */
export async function ProfileHeader({ user }: { user: UserView }) {
  const viewer = await getViewer();
  const isViewer = user.id === viewer.id;
  const friends = isFriend(user);
  const showInterests = canSeeInterests(user, viewer);
  const hasTags = user.interests.length > 0 || user.goals.length > 0;
  const canWrite = canMessage(user, viewer);
  const place = [user.university?.name, user.faculty].filter(Boolean).join(" · ");

  return (
    <header className="u-feed-divider px-4 pt-5 pb-5">
      <div className="flex items-center gap-4">
        <Avatar user={user} size="xl" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="min-w-0 truncate text-[20px] font-semibold">{user.nickname}</h2>
            {user.is_verified ? <Verified size={15} className="shrink-0" /> : null}
          </div>
          <p className="mt-1 text-[15px] leading-[1.4] text-ink-soft">{place}</p>
        </div>
      </div>

      {user.bio ? <p className="mt-4 text-[15px] leading-[1.4] text-ink">{user.bio}</p> : null}

      {/* Счётчики — строка текста, а не плитки с рамками. */}
      <div className="mt-2 flex items-center text-[14px] text-ink-soft">
        <CountLink
          href={`/u/${user.nickname}/follows?tab=followers`}
          value={user.follower_count}
          label={pluralRu(user.follower_count, ["подписчик", "подписчика", "подписчиков"])}
        />
        <span aria-hidden className="px-2">
          ·
        </span>
        <CountLink
          href={`/u/${user.nickname}/follows?tab=following`}
          value={user.following_count}
          label={pluralRu(user.following_count, ["подписка", "подписки", "подписок"])}
        />
      </div>

      {isViewer ? null : <Relationship user={user} friends={friends} />}

      {user.viewer_blocked ? (
        <BlockedNotice user={user} />
      ) : (
        <div className="mt-4">
          {isViewer ? (
            <ButtonLink href="/settings/profile" variant="quiet" size="md" full>
              Редактировать профиль
            </ButtonLink>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <FollowButton user={user} size="md" full />

                {canWrite ? (
                  <ButtonLink href={`/messages/${user.nickname}`} variant="quiet" size="md" full>
                    Написать
                  </ButtonLink>
                ) : (
                  <Button
                    variant="quiet"
                    size="md"
                    full
                    disabled
                    aria-describedby={`message-blocked-${user.id}`}
                  >
                    Написать
                  </Button>
                )}
              </div>

              {canWrite ? null : (
                <p id={`message-blocked-${user.id}`} className="mt-2 text-[13px] text-ink-soft">
                  {messageReason(user)}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {showInterests ? (
        hasTags ? (
          <div className="mt-5 space-y-3">
            {user.interests.length > 0 ? <TagGroup title="Интересы" items={user.interests} /> : null}
            {user.goals.length > 0 ? <TagGroup title="Цели" items={user.goals} /> : null}
          </div>
        ) : null
      ) : (
        <p className="mt-5 text-[13px] text-ink-soft">{interestsReason(user)}</p>
      )}
    </header>
  );
}

/** Follower and following counts. Tabular, because they sit side by side. */
function CountLink({ href, value, label }: { href: string; value: number; label: string }) {
  return (
    <Link href={href} className="inline-flex min-h-10 items-center gap-1.5 transition-colors hover:text-ink">
      <span className="u-tnum font-medium text-ink">{formatCount(value)}</span>
      {label}
    </Link>
  );
}

/**
 * Friends are a mutual follow, and friendship is what opens the "friends"
 * tier in every privacy setting — so say so instead of hinting at it.
 * Просто строка служебного текста: ни иконки, ни плашки.
 */
function Relationship({ user, friends }: { user: UserView; friends: boolean }) {
  if (!friends && !user.follows_viewer) return null;

  return (
    <p className="mt-1 text-[14px] leading-[1.4] text-ink-soft">
      {friends
        ? "Вы подписаны друг на друга — значит, вы друзья и видите то, что открыто только друзьям."
        : `Ты в подписках у ${user.nickname}. Подпишись взаимно — станете друзьями.`}
    </p>
  );
}

function TagGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="text-[13px] font-medium text-ink-faint">{title}</h3>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>
            <Pill>{item}</Pill>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Only reachable for the "friends" and "university" tiers. */
function interestsReason(user: UserView): string {
  return user.privacy_settings.who_can_see_interests === "friends"
    ? `${user.nickname} показывает интересы и цели только друзьям.`
    : user.university
      ? `${user.nickname} показывает интересы и цели только студентам ${user.university.short_name}.`
      : `${user.nickname} показывает интересы и цели только студентам своего вуза.`;
}

function messageReason(user: UserView): string {
  return user.privacy_settings.who_can_message === "friends"
    ? `${user.nickname} принимает сообщения только от друзей.`
    : `${user.nickname} не принимает личные сообщения.`;
}
