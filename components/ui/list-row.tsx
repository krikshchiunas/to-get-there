import type { Urgency } from "@/lib/format";

/**
 * Единственный источник геометрии строки списка.
 *
 * Лента, поиск, люди, список чатов, уведомления и настройки — это один и тот
 * же список с разным содержимым. Первый заход описал его прозой в контракте,
 * и шесть авторов прочитали прозу по-разному: разъехались отступы, размеры
 * времени, подсветка наведения и место галочки верификации. Поэтому классы
 * живут здесь, а не в каждой строке отдельно.
 */

/** Контейнер строки: отступы, разделитель снизу, подсветка наведения. */
export const listRow =
  "u-feed-divider relative flex gap-3 px-4 py-3.5 transition-colors hover:bg-sunken";

/**
 * Ведущий слот. В ленте, поиске и чатах это аватар 40px; в списках, где
 * аватар был бы повтором (идеи в профиле, чаты идей), — время. Ширина слота
 * 44px, потому что «06:30» при 15px занимает 42px — замерено в браузере, на
 * 40px время переносилось на вторую строку. Аватар прижат к левому краю
 * слота, поэтому колонка текста везде начинается на одной вертикали.
 */
export const listLead = "w-11 shrink-0";

/** Время события: единственное исключение из «всё служебное серое». */
export const listTime = "u-tnum shrink-0 whitespace-nowrap text-[15px] font-medium";

/** Метка времени сообщения — это метаданные, а не время события. */
export const listStamp = "u-tnum shrink-0 text-[14px] text-ink-soft";

export const listTitle = "text-[16px] leading-[1.35] font-medium text-ink";
export const listBody = "text-[15px] leading-[1.4] text-ink-soft";
export const listMeta = "text-[14px] text-ink-soft";

/** Заголовок группы: день в ленте, «Новые» в уведомлениях. */
export const groupHeading = "px-4 pt-6 pb-2 text-[13px] font-medium text-ink-faint";

/** Размер галочки верификации рядом с ником. На аватаре её не дублируем. */
export const verifiedSize = 14;

/**
 * Два состояния, не три. Прошедшее событие не красится отдельно: оно уже
 * помечено плашкой, а третий цвет времени ломает правило двух ролей.
 */
export function eventTimeTone(urgency: Urgency): string {
  return urgency === "now" || urgency === "soon" ? "text-heat" : "text-ink";
}
