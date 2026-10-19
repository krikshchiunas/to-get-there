/** Страница идеи: сама идея, состав чата, сообщения, голосования. */

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import type {
  ChatRole,
  MessageView,
  ModeratorPermissions,
  ParticipantView,
  PollView,
  PostView,
} from "@/lib/types";
import {
  noSocialFacts,
  toModeratorPermissions,
  toPollOptions,
  toUserView,
} from "./map";
import { loadFollowCounts } from "./social";
import { requireViewerId } from "./session";
import { POST_SELECT, toPostViews, type PostRow } from "./feed";

type UserWithUniversity = Tables<"users"> & { university: Tables<"universities"> | null };

export async function getPost(id: string): Promise<PostView | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_SELECT).eq("id", id).maybeSingle();
  if (!data) return undefined;
  const [view] = await toPostViews([data as unknown as PostRow]);
  return view;
}

/** Автор и модераторы идеи — основа для роли любого человека в её чате. */
async function loadChatRoles(postId: string) {
  const supabase = await createClient();
  const [post, moderators, participants] = await Promise.all([
    supabase.from("posts").select("author_id").eq("id", postId).maybeSingle(),
    supabase.from("post_moderators").select("user_id,permissions").eq("post_id", postId),
    supabase.from("post_participants").select("user_id").eq("post_id", postId),
  ]);

  const permissions = new Map<string, ModeratorPermissions>();
  for (const row of moderators.data ?? []) {
    permissions.set(row.user_id, toModeratorPermissions(row.permissions));
  }

  return {
    authorId: post.data?.author_id ?? null,
    permissions,
    participants: new Set((participants.data ?? []).map((row) => row.user_id)),
    roleOf(userId: string): ChatRole {
      if (post.data?.author_id === userId) return "author";
      if (permissions.has(userId)) return "moderator";
      return this.participants.has(userId) ? "participant" : "guest";
    },
  };
}

export async function getParticipants(postId: string): Promise<ParticipantView[]> {
  const supabase = await createClient();
  const [{ data }, roles] = await Promise.all([
    supabase
      .from("post_participants")
      .select("*,user:users(*,university:universities(*))")
      .eq("post_id", postId)
      .order("joined_at", { ascending: true }),
    loadChatRoles(postId),
  ]);

  const rows = (data ?? []) as unknown as Array<
    Tables<"post_participants"> & { user: UserWithUniversity | null }
  >;
  const counts = await loadFollowCounts(rows.map((row) => row.user_id));

  return rows.flatMap((row) => {
    if (!row.user) return [];
    const role = roles.roleOf(row.user_id);
    return [
      {
        id: row.id,
        post_id: row.post_id,
        user_id: row.user_id,
        joined_at: row.joined_at,
        user: toUserView(row.user, counts.get(row.user_id) ?? noSocialFacts),
        role,
        permissions:
          role === "author"
            ? { can_post_media: true, can_pin: true, can_poll: true, can_kick: true }
            : (roles.permissions.get(row.user_id) ?? null),
      },
    ];
  });
}

export async function getMessages(postId: string): Promise<MessageView[]> {
  const supabase = await createClient();
  const [{ data }, roles] = await Promise.all([
    supabase
      .from("messages")
      .select("*,author:users(*,university:universities(*))")
      .eq("post_id", postId)
      .order("created_at", { ascending: true }),
    loadChatRoles(postId),
  ]);

  const rows = (data ?? []) as unknown as Array<
    Tables<"messages"> & { author: UserWithUniversity | null }
  >;
  const counts = await loadFollowCounts(rows.map((row) => row.author_id));

  return rows.flatMap((row) =>
    row.author
      ? [
          {
            id: row.id,
            post_id: row.post_id,
            author_id: row.author_id,
            content: row.content,
            media_url: row.media_url,
            is_pinned: row.is_pinned,
            created_at: row.created_at,
            author: toUserView(row.author, counts.get(row.author_id) ?? noSocialFacts),
            role: roles.roleOf(row.author_id),
          },
        ]
      : [],
  );
}

export async function getPinnedMessage(postId: string): Promise<MessageView | undefined> {
  return (await getMessages(postId)).find((message) => message.is_pinned);
}

export async function getPolls(postId: string): Promise<PollView[]> {
  const supabase = await createClient();
  const viewerId = await requireViewerId();

  const { data } = await supabase
    .from("polls")
    .select("*,author:users(*,university:universities(*)),poll_votes(option_index,user_id)")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as Array<
    Tables<"polls"> & {
      author: UserWithUniversity | null;
      poll_votes: Array<{ option_index: number; user_id: string }> | null;
    }
  >;
  const counts = await loadFollowCounts(rows.map((row) => row.created_by));

  return rows.flatMap((row) => {
    if (!row.author) return [];
    const options = toPollOptions(row.options);
    const votes = row.poll_votes ?? [];

    const tally = options.map(
      (_, index) => votes.filter((vote) => vote.option_index === index).length,
    );

    return [
      {
        id: row.id,
        post_id: row.post_id,
        created_by: row.created_by,
        question: row.question,
        options,
        created_at: row.created_at,
        author: toUserView(row.author, counts.get(row.created_by) ?? noSocialFacts),
        tally,
        total_votes: votes.length,
        viewer_choice: votes.find((vote) => vote.user_id === viewerId)?.option_index ?? null,
      },
    ];
  });
}

export async function getViewerPermissions(postId: string): Promise<ModeratorPermissions | null> {
  const viewerId = await requireViewerId();
  const roles = await loadChatRoles(postId);
  if (roles.authorId === viewerId) {
    return { can_post_media: true, can_pin: true, can_poll: true, can_kick: true };
  }
  return roles.permissions.get(viewerId) ?? null;
}

export async function getRole(postId: string, userId: string): Promise<ChatRole> {
  return (await loadChatRoles(postId)).roleOf(userId);
}

/** Список чатов идей: где зритель состоит, последняя активность сверху. */
export async function getMyIdeaChats(): Promise<
  Array<{ post: PostView; last_message: MessageView | undefined; participant_count: number }>
> {
  const supabase = await createClient();
  const viewerId = await requireViewerId();

  const { data: memberships } = await supabase
    .from("post_participants")
    .select("post_id")
    .eq("user_id", viewerId);

  const postIds = (memberships ?? []).map((row) => row.post_id);
  if (postIds.length === 0) return [];

  const { data } = await supabase.from("posts").select(POST_SELECT).in("id", postIds);
  const posts = await toPostViews((data ?? []) as unknown as PostRow[]);

  const entries = await Promise.all(
    posts.map(async (post) => {
      const messages = await getMessages(post.id);
      return {
        post,
        last_message: messages[messages.length - 1],
        participant_count: post.participant_count,
      };
    }),
  );

  return entries.sort((a, b) => {
    const left = a.last_message?.created_at ?? a.post.created_at;
    const right = b.last_message?.created_at ?? b.post.created_at;
    return right.localeCompare(left);
  });
}
