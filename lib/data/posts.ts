/** Страница идеи: сама идея, состав чата, сообщения, голосования. */

import { CHAT_MEDIA_BUCKET } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import type {
  ChatPreview,
  ChatRole,
  MessageView,
  ModeratorPermissions,
  ParticipantView,
  PollView,
  PostView,
  ReplyPreview,
} from "@/lib/types";
import { noSocialFacts, toModeratorPermissions, toPollOptions, toUserView } from "./map";
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

/** Подписанная ссылка живёт час; открытая страница обновляется раньше по realtime. */
const MEDIA_LINK_TTL_SECONDS = 60 * 60;

/**
 * Сколько последних сообщений показывает чат. Чат идеи живёт вокруг одной
 * встречи, и столько хватает с запасом; без предела страница тянула бы всю
 * историю на каждый сигнал realtime.
 */
export const CHAT_HISTORY_LIMIT = 300;

type MessageRow = Tables<"messages"> & { author: UserWithUniversity | null };

/** Цитаты для ответов: исходное ищется среди загруженных, остальное — одним запросом. */
async function loadReplyPreviews(rows: MessageRow[]): Promise<Map<string, ReplyPreview>> {
  const previews = new Map<string, ReplyPreview>();
  const byId = new Map(rows.map((row) => [row.id, row]));
  const missing = new Set<string>();

  for (const row of rows) {
    if (!row.reply_to_id) continue;
    const original = byId.get(row.reply_to_id);
    if (original?.author) {
      previews.set(original.id, previewOf(original.id, original.author.nickname, original));
    } else if (!original) {
      missing.add(row.reply_to_id);
    }
  }

  if (missing.size > 0) {
    const supabase = await createClient();
    // RLS: исходное от заблокированного или из скрытого чата не придёт.
    const { data } = await supabase
      .from("messages")
      .select("id,content,media_url,author:users(nickname)")
      .in("id", [...missing]);
    for (const item of (data ?? []) as unknown as Array<{
      id: string;
      content: string;
      media_url: string | null;
      author: { nickname: string } | null;
    }>) {
      if (item.author) previews.set(item.id, previewOf(item.id, item.author.nickname, item));
    }
  }

  return previews;
}

function previewOf(
  id: string,
  nickname: string,
  message: { content: string; media_url: string | null },
): ReplyPreview {
  return {
    id,
    author_nickname: nickname,
    content: message.content.trim(),
    has_media: message.media_url !== null,
  };
}

export async function getMessages(postId: string): Promise<MessageView[]> {
  const supabase = await createClient();
  const [{ data }, roles] = await Promise.all([
    supabase
      .from("messages")
      .select("*,author:users(*,university:universities(*))")
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .limit(CHAT_HISTORY_LIMIT),
    loadChatRoles(postId),
  ]);

  const rows = ((data ?? []) as unknown as MessageRow[]).reverse();
  const [counts, replies] = await Promise.all([
    loadFollowCounts(rows.map((row) => row.author_id)),
    loadReplyPreviews(rows),
  ]);

  // Бакет приватный: ссылка подписывается от имени читающего и проходит
  // через политику post_media_read_chat. Не в чате — ссылки нет.
  const mediaPaths = rows.flatMap((row) => (row.media_url ? [row.media_url] : []));
  const signed = new Map<string, string>();
  if (mediaPaths.length > 0) {
    const { data: urls } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .createSignedUrls(mediaPaths, MEDIA_LINK_TTL_SECONDS);
    for (const item of urls ?? []) {
      if (item.path && item.signedUrl && !item.error) signed.set(item.path, item.signedUrl);
    }
  }

  return rows.flatMap((row) =>
    row.author
      ? [
          {
            id: row.id,
            post_id: row.post_id,
            author_id: row.author_id,
            content: row.content,
            media_url: row.media_url,
            media_src: row.media_url ? (signed.get(row.media_url) ?? null) : null,
            is_pinned: row.is_pinned,
            reply_to_id: row.reply_to_id,
            reply_to: row.reply_to_id ? (replies.get(row.reply_to_id) ?? null) : null,
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

    const tally = options.map((_, index) => votes.filter((vote) => vote.option_index === index).length);

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

/** Последняя строка чата, как её отдаёт вложенный ресурс в getMyIdeaChats. */
interface LastMessageRow {
  author_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
  author: { nickname: string } | null;
}

/**
 * Список чатов идей: где зритель состоит, последняя активность сверху.
 *
 * Один запрос: идеи, где зритель в чате (автора туда сажает триггер), и по
 * одному последнему сообщению на каждую — лимит вложенного ресурса
 * PostgREST считается на каждую идею, а не на весь ответ. Историю чатов
 * список не грузит: раньше здесь на каждую идею поднимались до
 * CHAT_HISTORY_LIMIT сообщений с авторами, цитатами и ссылками на фото
 * ради одной строки превью.
 */
export async function getMyIdeaChats(): Promise<
  Array<{ post: PostView; last_message: ChatPreview | undefined; participant_count: number }>
> {
  const supabase = await createClient();
  const viewerId = await requireViewerId();

  const { data } = await supabase
    .from("posts")
    .select(
      `${POST_SELECT},me:post_participants!inner(user_id),` +
        "messages(author_id,content,media_url,created_at,author:users(nickname))",
    )
    .eq("me.user_id", viewerId)
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" });

  const rows = (data ?? []) as unknown as Array<PostRow & { messages: LastMessageRow[] | null }>;
  if (rows.length === 0) return [];

  const lastByPost = new Map(rows.map((row) => [row.id, row.messages?.[0]]));
  const posts = await toPostViews(rows);

  const entries = posts.map((post) => {
    const last = lastByPost.get(post.id);
    return {
      post,
      last_message: last
        ? {
            author_id: last.author_id,
            author_nickname: last.author?.nickname ?? null,
            content: last.content,
            media_url: last.media_url,
            created_at: last.created_at,
          }
        : undefined,
      participant_count: post.participant_count,
    };
  });

  return entries.sort((a, b) => {
    const left = a.last_message?.created_at ?? a.post.created_at;
    const right = b.last_message?.created_at ?? b.post.created_at;
    return right.localeCompare(left);
  });
}
