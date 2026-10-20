/**
 * Где лежат файлы и как выглядят их пути.
 *
 * Пути проверяются дважды: политиками storage.objects (0009) при загрузке и
 * здесь — когда путь или ссылка попадает в строку базы. Без второй проверки
 * в avatar_url можно было бы записать любой внешний адрес (пиксель слежения
 * сработал бы у каждого, кто открыл профиль), а в messages.media_url —
 * чужой файл из другого чата.
 */

export const AVATAR_BUCKET = "avatars";
export const CHAT_MEDIA_BUCKET = "post-media";

/** Пределы бакетов из 0009 — проверяем до загрузки, чтобы ответить понятно. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const CHAT_MEDIA_MAX_BYTES = 10 * 1024 * 1024;

/** Что принимаем на входе. Всё, кроме GIF, перекодируется (lib/upload.ts). */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_RE = new RegExp(`^${UUID}$`);
const EXT = "(?:webp|jpg|png|gif)";

/** Путь медиа в чате: `<post_id>/<uuid>.<ext>` — папка идеи и случайное имя. */
export function chatMediaPath(postId: string, fileId: string, ext: string): string {
  return `${postId}/${fileId}.${ext}`;
}

/** Имя файла в папке: случайный uuid и одно из разрешённых расширений. */
const FILE_NAME_RE = new RegExp(`^${UUID}\\.${EXT}$`);

export function isChatMediaPath(path: string, postId: string): boolean {
  if (!UUID_RE.test(postId)) return false;
  // Без регулярки из входных данных: папка — точным сравнением префикса,
  // имя — фиксированным выражением.
  const folder = `${postId}/`;
  return path.startsWith(folder) && FILE_NAME_RE.test(path.slice(folder.length));
}

/** Путь аватара: `<user_id>/<uuid>.<ext>`. */
export function avatarPath(userId: string, fileId: string, ext: string): string {
  return `${userId}/${fileId}.${ext}`;
}

/** Публичная ссылка на аватар — бакет avatars открыт на чтение. */
export function avatarPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}

/**
 * Ссылка ведёт на аватар этого человека в нашем хранилище — и никуда больше.
 * Ни другого хоста, ни чужой папки, ни `..` в пути.
 */
export function isOwnAvatarUrl(url: string, supabaseUrl: string, userId: string): boolean {
  if (!UUID_RE.test(userId)) return false;
  const prefix = avatarPublicUrl(supabaseUrl, `${userId}/`);
  if (!url.startsWith(prefix)) return false;
  return FILE_NAME_RE.test(url.slice(prefix.length));
}

/** Путь файла внутри бакета по публичной ссылке — чтобы удалить старый аватар. */
export function avatarPathFromUrl(url: string, supabaseUrl: string): string | null {
  const prefix = avatarPublicUrl(supabaseUrl, "");
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}
