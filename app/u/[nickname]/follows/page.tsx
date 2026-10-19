import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/profile/follow-button";
import { UserRow } from "@/components/profile/user-row";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import {
  canSeeProfile,
  getViewer,
  getFollowers,
  getFollowing,
  getUserByNickname,
} from "@/lib/data";
import type { UserView } from "@/lib/types";

type FollowsTab = "followers" | "following";

type FollowsPageProps = {
  params: Promise<{ nickname: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
};

const tabLabels: Record<FollowsTab, string> = {
  followers: "Подписчики",
  following: "Подписки",
};

function tabFrom(value: string | string[] | undefined): FollowsTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "following" ? "following" : "followers";
}

export async function generateMetadata({
  params,
  searchParams,
}: FollowsPageProps): Promise<Metadata> {
  const { nickname } = await params;
  const user = await getUserByNickname(nickname);

  if (!user) return { title: "Профиль не найден" };

  const { tab } = await searchParams;
  return { title: `${tabLabels[tabFrom(tab)]} — ${user.nickname}` };
}

export default async function FollowsPage({ params, searchParams }: FollowsPageProps) {
  const { nickname } = await params;
  const user = await getUserByNickname(nickname);

  if (!user) notFound();
  // The follow graph is part of the profile: if the profile is closed to the
  // viewer, this list is too.
  const viewer = await getViewer();
  if (!canSeeProfile(user, viewer)) notFound();

  const { tab } = await searchParams;
  const active = tabFrom(tab);

  const followers = await getFollowers(user.id);
  const following = await getFollowing(user.id);
  const people = active === "followers" ? followers : following;
  const base = `/u/${user.nickname}/follows`;

  return (
    <>
      <PageHeader title={user.nickname} backHref={`/u/${user.nickname}`} />

      <Segmented
        ariaLabel="Подписчики и подписки"
        active={active}
        items={[
          {
            value: "followers",
            label: tabLabels.followers,
            href: `${base}?tab=followers`,
            count: followers.length,
          },
          {
            value: "following",
            label: tabLabels.following,
            href: `${base}?tab=following`,
            count: following.length,
          },
        ]}
      />

      {people.length > 0 ? (
        // Линия живёт на самой строке (`u-feed-divider` в `UserRow`), а
        // `u-feed` гасит её у последнего элемента — как во всех списках.
        // списку остаётся только убрать её у последнего элемента.
        <ul className="u-feed">
          {people.map((person) => (
            <li key={person.id}>
              <UserRow user={person} viewerId={viewer.id} />
            </li>
          ))}
        </ul>
      ) : (
        <FollowsEmpty user={user} tab={active} viewerId={viewer.id} />
      )}
    </>
  );
}

function FollowsEmpty({
  user,
  tab,
  viewerId,
}: {
  user: UserView;
  tab: FollowsTab;
  viewerId: string;
}) {
  const isViewer = user.id === viewerId;

  if (tab === "followers") {
    return isViewer ? (
      <EmptyState
        icon="person"
        title="На тебя пока никто не подписан"
        body="Напиши идею. Кто придёт в чат, обычно остаётся в подписчиках."
        action={<ButtonLink href="/create">Создать идею</ButtonLink>}
      />
    ) : (
      <EmptyState
        icon="person"
        title={`На ${user.nickname} пока никто не подписан`}
        body="Можешь стать первым."
        action={<FollowButton user={user} />}
      />
    );
  }

  return isViewer ? (
    <EmptyState
      icon="person"
      title="У тебя пока нет подписок"
      body="Ищи людей через их идеи — так сразу видно, кто задумал то же, что и ты."
      action={<ButtonLink href="/search">Искать идеи</ButtonLink>}
    />
  ) : (
    <EmptyState
      icon="person"
      title={`У ${user.nickname} пока нет подписок`}
      body="Здесь появятся подписки этого человека."
      action={
        <ButtonLink href="/search" variant="quiet">
          Искать идеи
        </ButtonLink>
      }
    />
  );
}
