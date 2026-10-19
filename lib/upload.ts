"use client";

/**
 * Загрузка изображений из браузера прямо в Supabase Storage.
 *
 * Файл идёт с сессией пользователя, и куда его можно положить, решают
 * политики storage.objects (0009): аватар — только в свою папку, фото в
 * чат — только с правом can_post_media в этой идее.
 *
 * Перед загрузкой картинка перерисовывается через canvas. Это уменьшает вес
 * и, главное, стирает EXIF: в фото с телефона там лежат GPS-координаты
 * места съёмки, часто — дома. GIF не перерисовывается (canvas убил бы
 * анимацию), но и координат в GIF не бывает.
 */

import { createClient } from "@/lib/supabase/client";
import {
  ACCEPTED_IMAGE_TYPES,
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  CHAT_MEDIA_BUCKET,
  CHAT_MEDIA_MAX_BYTES,
  EXTENSION_BY_TYPE,
  avatarPath,
  avatarPublicUrl,
  chatMediaPath,
} from "@/lib/media";

export type UploadResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Сколько исходник может весить до пережатия — защита от зависшей вкладки. */
const SOURCE_MAX_BYTES = 25 * 1024 * 1024;

interface Prepared {
  blob: Blob;
  ext: string;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Пережать до `maxSide` по длинной стороне, без метаданных. */
async function prepareImage(file: File, maxSide: number, maxBytes: number): Promise<UploadResult<Prepared>> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, error: "Подойдёт JPG, PNG, WebP, AVIF или GIF." };
  }
  if (file.size > SOURCE_MAX_BYTES) {
    return { ok: false, error: "Файл слишком большой — до 25 МБ." };
  }

  if (file.type === "image/gif") {
    if (file.size > maxBytes) {
      return { ok: false, error: `GIF — не больше ${Math.round(maxBytes / 1024 / 1024)} МБ.` };
    }
    return { ok: true, value: { blob: file, ext: "gif" } };
  }

  let bitmap: ImageBitmap;
  try {
    // from-image: повернуть по EXIF до того, как EXIF исчезнет.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { ok: false, error: "Не получилось открыть картинку. Попробуй JPG или PNG." };
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return { ok: false, error: "Браузер не дал обработать картинку." };
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // WebP, а где браузер его не кодирует (старый Safari) — JPEG.
  for (const type of ["image/webp", "image/jpeg"]) {
    for (const quality of [0.86, 0.75, 0.6]) {
      const blob = await canvasToBlob(canvas, type, quality);
      if (!blob || blob.type !== type) break;
      if (blob.size <= maxBytes) return { ok: true, value: { blob, ext: EXTENSION_BY_TYPE[type] } };
    }
  }
  return { ok: false, error: "Картинка не ужалась до допустимого размера. Попробуй другую." };
}

function explainStorageError(message: string): string {
  if (/row-level security|unauthorized|403/i.test(message)) return "На это нет прав.";
  if (/payload too large|exceeded|413/i.test(message)) return "Файл слишком большой.";
  if (/mime|type/i.test(message)) return "Такой формат не принимаем.";
  return "Не получилось загрузить файл. Проверь интернет и попробуй ещё раз.";
}

/** Новый аватар: 512 px, в свою папку. Возвращает публичную ссылку. */
export async function uploadAvatar(file: File, userId: string): Promise<UploadResult<string>> {
  const prepared = await prepareImage(file, 512, AVATAR_MAX_BYTES);
  if (!prepared.ok) return prepared;

  const supabase = createClient();
  const path = avatarPath(userId, crypto.randomUUID(), prepared.value.ext);
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, prepared.value.blob, {
    contentType: prepared.value.blob.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) return { ok: false, error: explainStorageError(error.message) };

  return { ok: true, value: avatarPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", path) };
}

/** Фото в чат идеи: до 1600 px. Возвращает путь в приватном бакете. */
export async function uploadChatImage(file: File, postId: string): Promise<UploadResult<string>> {
  const prepared = await prepareImage(file, 1600, CHAT_MEDIA_MAX_BYTES);
  if (!prepared.ok) return prepared;

  const supabase = createClient();
  const path = chatMediaPath(postId, crypto.randomUUID(), prepared.value.ext);
  const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, prepared.value.blob, {
    contentType: prepared.value.blob.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) return { ok: false, error: explainStorageError(error.message) };

  return { ok: true, value: path };
}

/** Убрать файл, если сообщение с ним сервер не принял — не копить сирот. */
export async function discardChatImage(path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(CHAT_MEDIA_BUCKET).remove([path]);
}
