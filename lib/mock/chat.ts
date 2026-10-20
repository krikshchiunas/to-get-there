import type { ChatRole, MessageView, ModeratorPermissions, ParticipantView, PollView } from "@/lib/types";
import { userById, users } from "./users";
import { posts } from "./posts";
import { hoursAgo, minutesAgo } from "./time";

export const fullPermissions: ModeratorPermissions = {
  can_post_media: true,
  can_pin: true,
  can_poll: true,
  can_kick: true,
};

export const noPermissions: ModeratorPermissions = {
  can_post_media: false,
  can_pin: false,
  can_poll: false,
  can_kick: false,
};

type RosterEntry = {
  user_id: string;
  role: ChatRole;
  permissions?: Partial<ModeratorPermissions>;
  minutes_ago: number;
};

/**
 * Hand-written rosters for the ideas that need specific roles — a moderator
 * with named rights, or the viewer taking part. Every other idea gets its
 * roster generated, see `rosterFor`.
 */
const explicitRoster: Record<
  string,
  Array<{ user_id: string; role: ChatRole; permissions?: Partial<ModeratorPermissions>; minutes_ago: number }>
> = {
  "p-kanal": [
    { user_id: "u-jonas", role: "author", minutes_ago: 360 },
    {
      user_id: "u-mira",
      role: "moderator",
      permissions: { can_pin: true, can_poll: true },
      minutes_ago: 330,
    },
    { user_id: "me", role: "participant", minutes_ago: 180 },
    { user_id: "u-tobi", role: "participant", minutes_ago: 120 },
    { user_id: "u-kwame", role: "participant", minutes_ago: 65 },
  ],
  "p-analysis": [
    { user_id: "u-mira", role: "author", minutes_ago: 1800 },
    {
      user_id: "me",
      role: "moderator",
      permissions: { can_pin: true, can_poll: true, can_post_media: true },
      minutes_ago: 1500,
    },
    { user_id: "u-tobi", role: "participant", minutes_ago: 900 },
    { user_id: "u-kwame", role: "participant", minutes_ago: 240 },
  ],
  "p-ostbloc": [
    { user_id: "me", role: "author", minutes_ago: 540 },
    { user_id: "u-tobi", role: "participant", minutes_ago: 300 },
    { user_id: "u-svenja", role: "moderator", permissions: fullPermissions, minutes_ago: 200 },
  ],
  "p-lesekreis": [
    { user_id: "u-ayse", role: "author", minutes_ago: 3600 },
    { user_id: "me", role: "participant", minutes_ago: 2000 },
    { user_id: "u-elif", role: "participant", minutes_ago: 1800 },
    { user_id: "u-yara", role: "participant", minutes_ago: 1500 },
    { user_id: "u-nina", role: "participant", minutes_ago: 900 },
    { user_id: "u-jan", role: "participant", minutes_ago: 400 },
  ],
  "p-flohmarkt": [
    { user_id: "me", role: "author", minutes_ago: 300 },
    { user_id: "u-nina", role: "participant", minutes_ago: 120 },
  ],
  "p-mensa": [
    { user_id: "u-tobi", role: "author", minutes_ago: 1560 },
    { user_id: "u-paul", role: "participant", minutes_ago: 900 },
  ],
};

/** Everyone except the signed-in user — the pool rosters are filled from. */
const pool = users.filter((user) => user.id !== "me");

function seedOf(postId: string): number {
  let hash = 0;
  for (let i = 0; i < postId.length; i += 1) hash = (hash * 31 + postId.charCodeAt(i)) % 9973;
  return hash;
}

const rosterCache = new Map<string, RosterEntry[]>();

/**
 * The roster of an idea chat, always as long as the participant count shown
 * on its card. The author is always in it; the viewer is in it exactly when
 * the post says so (`viewer_role`); the rest are filled deterministically, so
 * the server and the client render the same list.
 */
function rosterFor(postId: string): RosterEntry[] {
  const cached = rosterCache.get(postId);
  if (cached) return cached;

  const post = posts.find((candidate) => candidate.id === postId);
  const entries: RosterEntry[] = [...(explicitRoster[postId] ?? [])];

  if (post) {
    if (!entries.some((entry) => entry.user_id === post.author_id)) {
      entries.unshift({ user_id: post.author_id, role: "author", minutes_ago: 2400 });
    }

    if (post.viewer_role !== "guest" && !entries.some((entry) => entry.user_id === "me")) {
      entries.push({ user_id: "me", role: post.viewer_role, minutes_ago: 1500 });
    }

    const seed = seedOf(postId);
    for (let i = 0; entries.length < post.participant_count && i < pool.length; i += 1) {
      const candidate = pool[(seed + i) % pool.length];
      if (entries.some((entry) => entry.user_id === candidate.id)) continue;
      entries.push({
        user_id: candidate.id,
        role: "participant",
        minutes_ago: 1200 - entries.length * 45,
      });
    }
  }

  rosterCache.set(postId, entries);
  return entries;
}

export function participantsOf(postId: string): ParticipantView[] {
  const entries = rosterFor(postId);
  return entries.map((entry, index) => {
    const user = userById.get(entry.user_id);
    if (!user) throw new Error(`Unknown participant: ${entry.user_id}`);
    return {
      id: `${postId}-pp-${index}`,
      post_id: postId,
      user_id: entry.user_id,
      joined_at: minutesAgo(entry.minutes_ago),
      user,
      role: entry.role,
      permissions:
        entry.role === "author"
          ? fullPermissions
          : entry.role === "moderator"
            ? { ...noPermissions, ...entry.permissions }
            : null,
    };
  });
}

/** Role of a given user inside an idea chat. */
export function roleOf(postId: string, userId: string): ChatRole {
  return rosterFor(postId).find((e) => e.user_id === userId)?.role ?? "guest";
}

export function permissionsOf(postId: string, userId: string): ModeratorPermissions | null {
  const entry = rosterFor(postId).find((e) => e.user_id === userId);
  if (!entry) return null;
  if (entry.role === "author") return fullPermissions;
  if (entry.role === "moderator") return { ...noPermissions, ...entry.permissions };
  return null;
}

type MessageSeed = {
  author_id: string;
  content: string;
  minutes_ago: number;
  pinned?: boolean;
  media?: string;
  /** Индекс сообщения этого же чата, на которое это — ответ. */
  reply_to?: number;
};

const threads: Record<string, MessageSeed[]> = {
  "p-kanal": [
    {
      author_id: "u-jonas",
      content:
        "Собираемся на газоне напротив ларька у Адмиральского моста. Я на месте с половины восьмого, плед беру.",
      minutes_ago: 340,
      pinned: true,
    },
    { author_id: "u-mira", content: "Я прямо из библиотеки, задержусь минут на десять.", minutes_ago: 300 },
    { author_id: "me", content: "Что-нибудь принести? Я всё равно пройду мимо ларька.", minutes_ago: 240 },
    {
      author_id: "u-jonas",
      content: "Мороженое было бы отлично, остальное есть.",
      minutes_ago: 235,
      reply_to: 2,
    },
    { author_id: "u-tobi", content: "Я впервые с вами, как вас узнать?", minutes_ago: 120 },
    {
      author_id: "u-mira",
      content: "Жёлтый плед и два велосипеда рядом. Напиши, когда будешь на месте.",
      minutes_ago: 114,
      reply_to: 4,
    },
    { author_id: "u-kwame", content: "Беру с собой коробку черешни.", minutes_ago: 58 },
    { author_id: "me", content: "Отлично, тогда до вечера.", minutes_ago: 42 },
  ],
  "p-analysis": [
    {
      author_id: "u-mira",
      content:
        "Аудитория MA 041 забронирована с десяти до двух. План: сначала экзамен 2024 года, потом задачи, на которых застряли.",
      minutes_ago: 1400,
      pinned: true,
    },
    {
      author_id: "me",
      content: "Я набрала решения третьей и четвёртой задачи, выложу позже.",
      minutes_ago: 1200,
    },
    {
      author_id: "u-tobi",
      content: "Я всё ещё не понимаю теорему Стокса. Кто-нибудь объяснит?",
      minutes_ago: 900,
    },
    {
      author_id: "u-mira",
      content: "Выделим на это пятнадцать минут в начале. Возьми конспект.",
      minutes_ago: 880,
    },
    { author_id: "u-kwame", content: "Кофе беру на всех, скажите только, кому не нужно.", minutes_ago: 200 },
  ],
  "p-ostbloc": [
    {
      author_id: "me",
      content:
        "Дневной билет со студенческим — 11 евро, прокат скальников — 4. Встречаемся у входа, я буду без пяти шесть.",
      minutes_ago: 500,
      pinned: true,
    },
    { author_id: "u-svenja", content: "Могу принести магнезию и тейп.", minutes_ago: 320 },
    { author_id: "u-tobi", content: "Я никогда не лазил. Спортивной формы достаточно?", minutes_ago: 280 },
    { author_id: "me", content: "Вполне. Всё остальное берётся на месте.", minutes_ago: 270 },
  ],
  "p-lesekreis": [
    {
      author_id: "u-ayse",
      content: "На этой неделе страницы с 1 по 34. Читаем по очереди вслух, идеально читать никто не обязан.",
      minutes_ago: 3000,
      pinned: true,
    },
    { author_id: "u-elif", content: "Есть PDF этого издания? В моей библиотеке его нет.", minutes_ago: 1700 },
    {
      author_id: "u-ayse",
      content: "Издание Reclam за три евро в книжном у Хакешер Маркт.",
      minutes_ago: 1680,
    },
    { author_id: "me", content: "У меня есть второй экземпляр, могу принести.", minutes_ago: 800 },
  ],
  "p-mensa": [
    { author_id: "u-tobi", content: "Стою у входа, серая куртка.", minutes_ago: 60 },
    { author_id: "u-paul", content: "Буду через пять минут.", minutes_ago: 35 },
  ],
  "p-festsaal": [
    {
      author_id: "u-ayse",
      content: "Спасибо всем, вечер получился хороший.",
      minutes_ago: 1200,
      pinned: true,
    },
    { author_id: "me", content: "Фотографии выложу завтра.", minutes_ago: 1100 },
  ],
  "p-flohmarkt": [
    { author_id: "me", content: "Я у главного входа с одиннадцати. Кто позже — напишите.", minutes_ago: 240 },
    { author_id: "u-nina", content: "Мне нужно зеркало, так что идеально.", minutes_ago: 100 },
  ],
};

export function messagesOf(postId: string): MessageView[] {
  const seeds = threads[postId] ?? [];
  const authorOf = (seed: MessageSeed) => {
    const author = userById.get(seed.author_id);
    if (!author) throw new Error(`Unknown message author: ${seed.author_id}`);
    return author;
  };
  return seeds
    .map((seed, index) => {
      const author = authorOf(seed);
      const original = seed.reply_to === undefined ? undefined : seeds[seed.reply_to];
      return {
        id: `${postId}-m-${index}`,
        post_id: postId,
        author_id: seed.author_id,
        content: seed.content,
        media_url: seed.media ?? null,
        is_pinned: seed.pinned ?? false,
        reply_to_id: original ? `${postId}-m-${seed.reply_to}` : null,
        reply_to: original
          ? {
              id: `${postId}-m-${seed.reply_to}`,
              author_nickname: authorOf(original).nickname,
              content: original.content,
              has_media: Boolean(original.media),
            }
          : null,
        created_at: minutesAgo(seed.minutes_ago),
        author,
        role: roleOf(postId, seed.author_id),
      } satisfies MessageView;
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

type PollSeed = {
  id: string;
  created_by: string;
  question: string;
  options: string[];
  tally: number[];
  viewer_choice: number | null;
  hours_ago: number;
};

const pollSeeds: Record<string, PollSeed[]> = {
  "p-kanal": [
    {
      id: "poll-kanal-1",
      created_by: "u-jonas",
      question: "Во сколько встречаемся?",
      options: ["19:00", "19:30", "20:00"],
      tally: [1, 4, 2],
      viewer_choice: 1,
      hours_ago: 5,
    },
  ],
  "p-analysis": [
    {
      id: "poll-analysis-1",
      created_by: "u-mira",
      question: "С чего начнём?",
      options: ["Интегральные теоремы", "Экзамен 2024 года", "Разбор вопросов"],
      tally: [2, 3, 1],
      viewer_choice: 0,
      hours_ago: 14,
    },
    {
      id: "poll-analysis-2",
      created_by: "me",
      question: "Вторая встреча ещё на этой неделе?",
      options: ["Четверг, 18:00", "Пятница, 10:00", "Лучше на следующей неделе"],
      tally: [3, 1, 1],
      viewer_choice: null,
      hours_ago: 3,
    },
  ],
  "p-tempelhof": [
    {
      id: "poll-tempelhof-1",
      created_by: "u-paul",
      question: "С какой стороны поля?",
      options: ["Oderstraße", "Columbiadamm"],
      tally: [6, 3],
      viewer_choice: null,
      hours_ago: 20,
    },
  ],
};

export function pollsOf(postId: string): PollView[] {
  const seeds = pollSeeds[postId] ?? [];
  return seeds.map((seed) => {
    const author = userById.get(seed.created_by);
    if (!author) throw new Error(`Unknown poll author: ${seed.created_by}`);
    return {
      id: seed.id,
      post_id: postId,
      created_by: seed.created_by,
      question: seed.question,
      options: seed.options.map((label) => ({ label })),
      created_at: hoursAgo(seed.hours_ago),
      author,
      tally: seed.tally,
      total_votes: seed.tally.reduce((sum, n) => sum + n, 0),
      viewer_choice: seed.viewer_choice,
    } satisfies PollView;
  });
}

/** Ideas the signed-in user takes part in. */
export function postIdsForViewer(userId: string): string[] {
  return posts
    .filter((post) => rosterFor(post.id).some((entry) => entry.user_id === userId))
    .map((post) => post.id);
}
