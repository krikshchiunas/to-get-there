import type { ConversationView, DirectMessage, UserView } from "@/lib/types";
import { isFriend } from "@/lib/types";
import { currentUser, userById } from "./users";
import { minutesAgo } from "./time";

type ThreadSeed = {
  partner_id: string;
  unread: number;
  messages: Array<{ from: "me" | "them"; content: string; minutes_ago: number; media?: string }>;
};

const threads: ThreadSeed[] = [
  {
    partner_id: "u-jonas",
    unread: 2,
    messages: [
      { from: "them", content: "Пойдёшь сегодня с нами на канал?", minutes_ago: 400 },
      { from: "me", content: "Да, я с вами. Мороженое брать?", minutes_ago: 380 },
      { from: "them", content: "Было бы здорово. Ванильное, если будет.", minutes_ago: 60 },
      { from: "them", content: "Мира тоже придёт, только позже.", minutes_ago: 42 },
    ],
  },
  {
    partner_id: "u-mira",
    unread: 0,
    messages: [
      { from: "them", content: "Сможешь завтра распечатать задачи с прошлых экзаменов?", minutes_ago: 1500 },
      { from: "me", content: "Сделаю, шесть копий?", minutes_ago: 1480 },
      { from: "them", content: "Шести хватит. Спасибо тебе.", minutes_ago: 1470 },
      { from: "me", content: "Уже лежат в рюкзаке.", minutes_ago: 300 },
    ],
  },
  {
    partner_id: "u-yara",
    unread: 1,
    messages: [
      { from: "me", content: "Привет, видела твой языковой обмен. Ещё ищешь человека?", minutes_ago: 900 },
      { from: "them", content: "Да! Испанский у меня родной, немецкий примерно B2.", minutes_ago: 880 },
      { from: "me", content: "Звучит хорошо. По средам я могла бы регулярно.", minutes_ago: 860 },
      { from: "them", content: "Среда в пять мне идеально подходит.", minutes_ago: 95 },
    ],
  },
  {
    partner_id: "u-svenja",
    unread: 0,
    messages: [
      { from: "them", content: "На боулдеринг я с вами, принесу тейп.", minutes_ago: 320 },
      { from: "me", content: "Супер, тогда сделаю тебя модератором в чате.", minutes_ago: 310 },
      { from: "them", content: "Возьму на себя плейлист.", minutes_ago: 300 },
    ],
  },
  {
    partner_id: "u-ayse",
    unread: 0,
    messages: [
      { from: "them", content: "Книжку Reclam принесу тебе завтра.", minutes_ago: 1600 },
      { from: "me", content: "Спасибо, отдам тебе три евро.", minutes_ago: 1590 },
    ],
  },
  {
    partner_id: "u-tobi",
    unread: 0,
    messages: [
      { from: "them", content: "Спасибо за советы по столовой!", minutes_ago: 2600 },
      { from: "me", content: "Обращайся. Карри по четвергам там лучшее.", minutes_ago: 2550 },
    ],
  },
  {
    partner_id: "u-elif",
    unread: 0,
    messages: [
      { from: "them", content: "На вечер настолок в чате только друзья, так что скажи, если захочешь.", minutes_ago: 4000 },
    ],
  },
];

function toMessages(seed: ThreadSeed): DirectMessage[] {
  return seed.messages
    .map((m, index) => ({
      id: `${seed.partner_id}-dm-${index}`,
      sender_id: m.from === "me" ? currentUser.id : seed.partner_id,
      receiver_id: m.from === "me" ? seed.partner_id : currentUser.id,
      content: m.content,
      media_url: m.media ?? null,
      created_at: minutesAgo(m.minutes_ago),
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Mirrors the `who_can_message` privacy setting of the recipient. */
export function canMessage(partner: UserView): boolean {
  if (partner.id === currentUser.id) return false;
  switch (partner.privacy_settings.who_can_message) {
    case "everyone":
      return true;
    case "friends":
      return isFriend(partner);
    case "nobody":
      return false;
  }
}

export function threadWith(partnerId: string): DirectMessage[] {
  const seed = threads.find((t) => t.partner_id === partnerId);
  return seed ? toMessages(seed) : [];
}

export function conversations(): ConversationView[] {
  return threads
    .map((seed) => {
      const partner = userById.get(seed.partner_id);
      if (!partner) throw new Error(`Unknown chat partner: ${seed.partner_id}`);
      const messages = toMessages(seed);
      return {
        partner,
        last_message: messages[messages.length - 1],
        unread_count: seed.unread,
        can_reply: canMessage(partner),
      } satisfies ConversationView;
    })
    .sort((a, b) => b.last_message.created_at.localeCompare(a.last_message.created_at));
}

export const totalUnreadDirect = threads.reduce((sum, t) => sum + t.unread, 0);
