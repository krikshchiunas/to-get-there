"use client";

import { useState } from "react";
import { Button, type ButtonSize } from "@/components/ui/button";
import type { UserView } from "@/lib/types";

/**
 * The one control that changes the follow graph.
 *
 * Three states, because the middle one is the interesting one: if the other
 * person already follows you, following back makes you friends — and friends
 * is the tier that opens profiles, interests and chats. So the button reads
 * "Подписаться взаимно" instead of "Подписаться" and names what is one tap
 * away.
 *
 * Два варианта заливки и ничего больше: `primary`, пока не подписан, и
 * `quiet`, когда подписан. Рамки нет, галочки нет — в Threads и Bluesky
 * состояние несёт сама заливка, а не иконка рядом с подписью.
 */
export function FollowButton({
  user,
  size = "md",
  full = false,
}: {
  user: Pick<UserView, "id" | "nickname" | "viewer_follows" | "follows_viewer">;
  size?: ButtonSize;
  full?: boolean;
}) {
  const [following, setFollowing] = useState(user.viewer_follows);

  function toggle() {
    // TODO(supabase): insert into follows (follower_id, following_id) on follow,
    // delete from follows where follower_id = auth.uid() and following_id = user.id on unfollow.
    setFollowing((current) => !current);
  }

  const becomesFriend = user.follows_viewer;
  const label = following ? "Вы подписаны" : becomesFriend ? "Подписаться взаимно" : "Подписаться";
  const hint = following
    ? becomesFriend
      ? `Вы с ${user.nickname} подписаны друг на друга`
      : `${user.nickname} у тебя в подписках`
    : becomesFriend
      ? `Ты в подписках у ${user.nickname} — подпишись взаимно, станете друзьями`
      : `Подписаться на ${user.nickname}`;

  return (
    <Button
      variant={following ? "quiet" : "primary"}
      size={size}
      full={full}
      aria-pressed={following}
      title={hint}
      onClick={toggle}
    >
      {label}
    </Button>
  );
}
