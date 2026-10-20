import type { NotificationSettings, PrivacySettings, UserView } from "@/lib/types";
import { universityById } from "./universities";
import { daysAgo } from "./time";

export const defaultPrivacy: PrivacySettings = {
  who_can_message: "everyone",
  who_can_see_profile: "everyone",
  who_can_see_interests: "everyone",
  visible_in_search: true,
  read_receipts: true,
};

/** Everything is on by default; each one can be switched off in settings. */
export const defaultNotifications: NotificationSettings = {
  new_participant: true,
  new_message_in_post: true,
  new_message_direct: true,
  new_follower: true,
  new_post_from_following: true,
  event_reminder_1h: true,
  event_reminder_30m: true,
};

type Seed = {
  id: string;
  nickname: string;
  university_id: string;
  faculty: string;
  bio: string;
  interests: string[];
  goals: string[];
  is_verified?: boolean;
  followers: number;
  following: number;
  /** Viewer -> this user. */
  viewer_follows?: boolean;
  /** This user -> viewer. Both true means friends. */
  follows_viewer?: boolean;
  privacy?: Partial<PrivacySettings>;
  joined_days_ago?: number;
};

function build(seed: Seed): UserView {
  const university = universityById.get(seed.university_id);
  if (!university) throw new Error(`Unknown university: ${seed.university_id}`);

  return {
    id: seed.id,
    nickname: seed.nickname,
    // Avatars arrive with Supabase Storage; until then every profile renders
    // as initials, which keeps the mock dataset offline-safe.
    avatar_url: null,
    university_id: seed.university_id,
    faculty: seed.faculty,
    bio: seed.bio,
    interests: seed.interests,
    goals: seed.goals,
    is_verified: seed.is_verified ?? false,
    privacy_settings: { ...defaultPrivacy, ...seed.privacy },
    notification_settings: { ...defaultNotifications },
    created_at: daysAgo(seed.joined_days_ago ?? 120),
    university,
    follower_count: seed.followers,
    following_count: seed.following,
    viewer_follows: seed.viewer_follows ?? false,
    follows_viewer: seed.follows_viewer ?? false,
    viewer_blocked: false,
  };
}

const seeds: Seed[] = [
  {
    id: "me",
    nickname: "mara_t",
    university_id: "u-tub",
    faculty: "Информатика, 3-й семестр",
    bio: "Недавно в Берлине. Ищу компанию для скалодрома и учебную группу по анализу.",
    interests: ["Боулдеринг", "Техно", "Готовка", "Велосипед", "Подкасты"],
    goals: ["Найти учебную группу", "Больше говорить по-немецки", "Напарника для скалодрома"],
    followers: 48,
    following: 61,
    joined_days_ago: 90,
  },
  {
    id: "u-jonas",
    nickname: "jonas_k",
    university_id: "u-tub",
    faculty: "Машиностроение, 5-й семестр",
    bio: "Всегда готов выпить пива у канала после занятий.",
    interests: ["Велосипед", "Крафтовое пиво", "Волейбол"],
    goals: ["Познакомиться с людьми в новом семестре"],
    is_verified: true,
    followers: 212,
    following: 180,
    viewer_follows: true,
    follows_viewer: true,
    joined_days_ago: 400,
  },
  {
    id: "u-mira",
    nickname: "mira.hv",
    university_id: "u-tub",
    faculty: "Математика, 3-й семестр",
    bio: "Либо анализ, либо смерть. Лучше анализ.",
    interests: ["Математика", "Шахматы", "Фильтр-кофе"],
    goals: ["Сдать экзамен", "Собрать учебную группу"],
    is_verified: true,
    followers: 94,
    following: 77,
    viewer_follows: true,
    follows_viewer: true,
    joined_days_ago: 300,
  },
  {
    id: "u-ayse",
    nickname: "ayse_dk",
    university_id: "u-hub",
    faculty: "Культурология, 7-й семестр",
    bio: "Читательские клубы, выставки и долгие прогулки по Митте.",
    interests: ["Литература", "Выставки", "Винил"],
    goals: ["Не дать читательскому клубу угаснуть"],
    followers: 331,
    following: 140,
    viewer_follows: true,
    joined_days_ago: 620,
  },
  {
    id: "u-tobi",
    nickname: "tobi",
    university_id: "u-tub",
    faculty: "Электротехника, 1-й семестр",
    bio: "Первокурсник. Ещё не нашёл столовую.",
    interests: ["Гейминг", "Настольные игры", "Баскетбол"],
    goals: ["Познакомиться с одногруппниками"],
    followers: 17,
    following: 55,
    follows_viewer: true,
    joined_days_ago: 22,
  },
  {
    id: "u-svenja",
    nickname: "svenja_l",
    university_id: "u-fub",
    faculty: "Биология, 4-й семестр",
    bio: "На улице лучше. Озёра, леса, велопоходы.",
    interests: ["Походы", "Плавание", "Птицы"],
    goals: ["Выбираться за город каждые выходные"],
    is_verified: true,
    followers: 156,
    following: 132,
    viewer_follows: true,
    follows_viewer: true,
    joined_days_ago: 350,
  },
  {
    id: "u-kwame",
    nickname: "kwame.o",
    university_id: "u-tub",
    faculty: "Информатика, магистратура",
    bio: "Днём бэкенд, вечером паб-квиз.",
    interests: ["Паб-квиз", "Rust", "Готовка"],
    goals: ["Собрать команду для квиза"],
    followers: 128,
    following: 90,
    viewer_follows: true,
    joined_days_ago: 500,
  },
  {
    id: "u-nina",
    nickname: "nina__b",
    university_id: "u-tub",
    faculty: "Архитектура, 6-й семестр",
    bio: "Снимаю мосты, пока город не проснулся.",
    interests: ["Плёночная фотография", "Архитектура", "Рассветы"],
    goals: ["Собрать портфолио"],
    is_verified: true,
    followers: 402,
    following: 61,
    viewer_follows: true,
    privacy: { who_can_see_profile: "university" },
    joined_days_ago: 540,
  },
  {
    id: "u-felix",
    nickname: "felix.rr",
    university_id: "u-lmu",
    faculty: "Экономика, 5-й семестр",
    bio: "Живу в Мюнхене, но часто в поезде до Берлина.",
    interests: ["Попутчики", "Футбол", "Кофе"],
    goals: ["Делить дорогу с кем-нибудь"],
    followers: 73,
    following: 88,
    viewer_follows: true,
    joined_days_ago: 260,
  },
  {
    id: "u-yara",
    nickname: "yara_m",
    university_id: "u-uhh",
    faculty: "Медицина, 2-й семестр",
    bio: "Языковой обмен немецкий–испанский, желательно с пирогом.",
    interests: ["Языки", "Выпечка", "Бег"],
    goals: ["Довести немецкий до C1"],
    is_verified: true,
    followers: 61,
    following: 44,
    viewer_follows: true,
    follows_viewer: true,
    joined_days_ago: 150,
  },
  {
    id: "u-paul",
    nickname: "paul_tm",
    university_id: "u-tub",
    faculty: "Строительство, 4-й семестр",
    bio: "Играю в футбол на Темпельхофер Фельд каждые выходные.",
    interests: ["Футбол", "Гриль", "Настольный теннис"],
    goals: ["Найти постоянную команду"],
    followers: 189,
    following: 201,
    viewer_follows: true,
    joined_days_ago: 310,
  },
  {
    id: "u-elif",
    nickname: "elif.s",
    university_id: "u-hub",
    faculty: "Психология, магистратура",
    bio: "Пишу магистерскую, нужно отвлекаться настольными играми.",
    interests: ["Настольные игры", "Йога", "Сериалы"],
    goals: ["Сдать магистерскую"],
    followers: 88,
    following: 51,
    privacy: { who_can_message: "friends" },
    joined_days_ago: 700,
  },
  {
    id: "u-jan",
    nickname: "jan_o",
    university_id: "u-kit",
    faculty: "Физика, 8-й семестр",
    bio: "Лучше почитаю, чем напишу.",
    interests: ["Астрономия", "Велопоходы"],
    goals: ["Тишина"],
    followers: 24,
    following: 12,
    privacy: { who_can_message: "nobody", visible_in_search: false },
    joined_days_ago: 800,
  },
  {
    id: "u-marta",
    nickname: "marta_w",
    university_id: "u-rwth",
    faculty: "Спортивные науки, 3-й семестр",
    bio: "Хоккей, плавание и ранние подъёмы.",
    interests: ["Хоккей", "Плавание", "Заготовка еды"],
    goals: ["Расширить тренировочную группу"],
    is_verified: true,
    followers: 143,
    following: 97,
    viewer_follows: true,
    joined_days_ago: 210,
  },
  {
    id: "u-dennis",
    nickname: "dennis.k",
    university_id: "u-koeln",
    faculty: "Юриспруденция, 6-й семестр",
    bio: "Карнавал — это отдельная специальность.",
    interests: ["Карнавал", "Готовка", "Бег"],
    goals: ["Пережить подготовку к экзаменам"],
    followers: 96,
    following: 120,
    joined_days_ago: 450,
  },
];

export const users: UserView[] = seeds.map(build);
export const userById = new Map(users.map((u) => [u.id, u]));
export const userByNickname = new Map(users.map((u) => [u.nickname, u]));

/** The signed-in user during stage 1–3. Auth replaces this at the very end. */
export const currentUser: UserView = userById.get("me")!;
