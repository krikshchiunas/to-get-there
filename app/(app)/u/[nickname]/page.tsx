import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfilePosts } from "@/components/profile/profile-posts";
import { FollowButton } from "@/components/profile/follow-button";
import { ProfileMenu } from "@/components/profile/profile-menu";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Verified } from "@/components/ui/verified";
import { canSeeProfile, getUserByNickname, getViewer } from "@/lib/data";
import type { UserView } from "@/lib/types";

/** The ideas on a profile depend on the clock, so nothing here is cached. */
export const dynamic = "force-dynamic";

type ProfilePageProps = { params: Promise<{ nickname: string }> };

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { nickname } = await params;
  const user = await getUserByNickname(nickname);

  if (!user) return { title: "Профиль не найден" };

  return {
    title: user.nickname,
    description: `Профиль ${user.nickname}, ${user.university.short_name}.`,
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { nickname } = await params;
  const user = await getUserByNickname(nickname);

  if (!user) notFound();

  const now = new Date();
  const viewer = await getViewer();
  const isViewer = user.id === viewer.id;

  return (
    <>
      <PageHeader
        title={user.nickname}
        subtitle={user.university.short_name}
        action={
          isViewer ? (
            <Link
              href="/settings"
              aria-label="Настройки"
              className="flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-sunken"
            >
              <Icon name="settings" size={19} />
            </Link>
          ) : (
            <ProfileMenu user={user} />
          )
        }
      />

      {canSeeProfile(user, viewer) ? (
        <>
          <ProfileHeader user={user} />
          {/* Заблокированному идеи не видны в обе стороны (0029): пустое
              состояние «пока нет идей» было бы неправдой. */}
          {user.viewer_blocked ? null : <ProfilePosts user={user} now={now} />}
        </>
      ) : (
        <RestrictedProfile user={user} />
      )}
    </>
  );
}

/**
 * What a visitor sees who is not allowed in: enough to recognise the person
 * and to follow them, and nothing of what they wrote. No counts, no
 * interests, no ideas.
 *
 * Объяснение лежит текстом прямо на фоне: панель с рамкой и иконкой в кружке
 * говорила бы, что закрытый профиль — это ошибка, а это просто настройка.
 */
function RestrictedProfile({ user }: { user: UserView }) {
  return (
    <div className="px-4 pt-5 pb-6">
      <div className="flex items-center gap-4">
        <Avatar user={user} size="xl" withBadge />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="min-w-0 truncate text-[20px] font-semibold">{user.nickname}</h2>
            {user.is_verified ? <Verified size={15} className="shrink-0" /> : null}
          </div>
          <p className="mt-1 text-[15px] leading-[1.4] text-ink-soft">{user.university.name}</p>
        </div>
      </div>

      <h3 className="mt-6 text-[15px] leading-[1.4] font-normal text-ink">Профиль закрыт</h3>
      <p className="mt-0.5 text-[15px] leading-[1.4] text-ink-soft">{restrictionReason(user)}</p>

      <div className="mt-4">
        <FollowButton user={user} size="md" />
      </div>
    </div>
  );
}

function restrictionReason(user: UserView): string {
  switch (user.privacy_settings.who_can_see_profile) {
    case "friends":
      return `${user.nickname} открывает профиль только друзьям. Друзьями вы станете, когда подпишетесь друг на друга.`;
    case "university":
      return `${user.nickname} открывает профиль только студентам ${user.university.short_name}. Ты учишься в другом вузе.`;
    case "everyone":
      return `${user.nickname} сейчас никому не показывает профиль.`;
  }
}
