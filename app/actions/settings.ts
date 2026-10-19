"use server";

/**
 * Настройки профиля, приватности и уведомлений.
 *
 * Обновлять можно только свою строку и только разрешённые колонки — это
 * держат политика users_update_own и гранты по колонкам из 0008. is_verified
 * и auth_user_id отсюда не меняются в принципе.
 */

import { revalidatePath } from "next/cache";
import type { NotificationSettings, PrivacySettings } from "@/lib/types";
import { fail, getActor, notSignedIn, type ActionResult } from "@/lib/actions/actor";

export interface ProfileInput {
  nickname: string;
  faculty: string;
  bio: string;
  interests: string[];
  goals: string[];
  avatarUrl?: string | null;
}

const NICKNAME = /^[a-z0-9][a-z0-9._]{2,23}$/;

function cleanTags(tags: string[], max: number, maxLen: number): string[] | string {
  const clean = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  if (clean.length > max) return `Не больше ${max}.`;
  if (clean.some((tag) => tag.length > maxLen)) return `Каждый — не длиннее ${maxLen} символов.`;
  return clean;
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return notSignedIn;

  const nickname = input.nickname.trim().toLowerCase();
  if (!NICKNAME.test(nickname)) {
    return { ok: false, error: "Ник — 3–24 символа: латиница, цифры, точка и подчёркивание, начинается с буквы или цифры." };
  }
  const faculty = input.faculty.trim();
  if (faculty && (faculty.length < 2 || faculty.length > 120)) {
    return { ok: false, error: "Факультет — от 2 до 120 символов." };
  }
  if (input.bio.length > 400) return { ok: false, error: "О себе — не больше 400 символов." };

  // Пределы из 0003: интересов до 20 по 40 символов, целей до 10 по 80.
  const interests = cleanTags(input.interests, 20, 40);
  if (typeof interests === "string") return { ok: false, error: `Интересы: ${interests}` };
  const goals = cleanTags(input.goals, 10, 80);
  if (typeof goals === "string") return { ok: false, error: `Цели: ${goals}` };

  const { error } = await actor.supabase
    .from("users")
    .update({
      nickname,
      faculty: faculty || null,
      bio: input.bio.trim() || null,
      interests,
      goals,
      ...(input.avatarUrl !== undefined ? { avatar_url: input.avatarUrl } : {}),
    })
    .eq("id", actor.viewerId);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Этот ник уже занят. Попробуй другой." };
    return fail(error);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updatePrivacy(settings: PrivacySettings): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return notSignedIn;

  // Только четыре известных ключа — лишний ключ отклонит CHECK в 0003.
  const clean: PrivacySettings = {
    who_can_message: settings.who_can_message,
    who_can_see_profile: settings.who_can_see_profile,
    who_can_see_interests: settings.who_can_see_interests,
    visible_in_search: Boolean(settings.visible_in_search),
  };

  const { error } = await actor.supabase
    .from("users")
    .update({ privacy_settings: { ...clean } })
    .eq("id", actor.viewerId);

  if (error) return fail(error);
  revalidatePath("/settings/privacy");
  return { ok: true };
}

export async function updateNotificationSettings(settings: NotificationSettings): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return notSignedIn;

  const clean: NotificationSettings = {
    new_participant: Boolean(settings.new_participant),
    new_message_in_post: Boolean(settings.new_message_in_post),
    new_message_direct: Boolean(settings.new_message_direct),
    new_follower: Boolean(settings.new_follower),
    new_post_from_following: Boolean(settings.new_post_from_following),
    event_reminder_1h: Boolean(settings.event_reminder_1h),
    event_reminder_30m: Boolean(settings.event_reminder_30m),
  };

  const { error } = await actor.supabase
    .from("users")
    .update({ notification_settings: { ...clean } })
    .eq("id", actor.viewerId);

  if (error) return fail(error);
  revalidatePath("/settings/notifications");
  return { ok: true };
}
