import type { Notification } from "@/lib/types";
import { currentUser, userById } from "./users";
import { postById } from "./posts";
import { minutesAgo } from "./time";

type Seed = {
  id: string;
  type: Notification["type"];
  actor_id?: string;
  post_id?: string;
  message_preview?: string;
  minutes_until?: number;
  minutes_ago: number;
  read?: boolean;
};

const seeds: Seed[] = [
  {
    id: "n-1",
    type: "new_participant",
    actor_id: "u-tobi",
    post_id: "p-ostbloc",
    minutes_ago: 18,
  },
  {
    id: "n-2",
    type: "event_reminder",
    post_id: "p-kanal",
    minutes_until: 60,
    minutes_ago: 25,
  },
  {
    id: "n-3",
    type: "new_message",
    actor_id: "u-kwame",
    post_id: "p-kanal",
    message_preview: "Беру с собой коробку черешни.",
    minutes_ago: 58,
  },
  {
    id: "n-4",
    type: "new_follower",
    actor_id: "u-tobi",
    minutes_ago: 140,
  },
  {
    id: "n-5",
    type: "new_post_from_following",
    actor_id: "u-nina",
    post_id: "p-sonnenaufgang",
    minutes_ago: 240,
    read: true,
  },
  {
    id: "n-6",
    type: "new_message",
    actor_id: "u-svenja",
    post_id: "p-ostbloc",
    message_preview: "Могу принести магнезию и тейп.",
    minutes_ago: 320,
    read: true,
  },
  {
    id: "n-7",
    type: "new_participant",
    actor_id: "u-nina",
    post_id: "p-flohmarkt",
    minutes_ago: 400,
    read: true,
  },
  {
    id: "n-8",
    type: "new_post_from_following",
    actor_id: "u-paul",
    post_id: "p-tempelhof",
    minutes_ago: 1400,
    read: true,
  },
  {
    id: "n-9",
    type: "new_follower",
    actor_id: "u-marta",
    minutes_ago: 2800,
    read: true,
  },
];

export const notifications: Notification[] = seeds.map((seed) => {
  const actor = seed.actor_id ? userById.get(seed.actor_id) : undefined;
  const post = seed.post_id ? postById.get(seed.post_id) : undefined;

  return {
    id: seed.id,
    user_id: currentUser.id,
    type: seed.type,
    payload: {
      ...(actor
        ? { actor_id: actor.id, actor_nickname: actor.nickname, actor_avatar_url: actor.avatar_url }
        : {}),
      ...(post ? { post_id: post.id, post_title: post.title } : {}),
      ...(seed.message_preview ? { message_preview: seed.message_preview } : {}),
      ...(seed.minutes_until ? { minutes_until: seed.minutes_until } : {}),
    },
    is_read: seed.read ?? false,
    created_at: minutesAgo(seed.minutes_ago),
  };
});

export const unreadNotificationCount = notifications.filter((n) => !n.is_read).length;
