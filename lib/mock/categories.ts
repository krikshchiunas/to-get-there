import type { Category } from "@/lib/types";

/**
 * `is_main` categories are offered up front when creating a post or
 * filtering; the rest sit behind the "Другое" button.
 */
export const categories: Category[] = [
  { id: "c-feiern", name: "Вечеринки", is_main: true, icon: "glass" },
  { id: "c-sport", name: "Спорт", is_main: true, icon: "ball" },
  { id: "c-lernen", name: "Учёба", is_main: true, icon: "book" },
  { id: "c-essen", name: "Еда", is_main: true, icon: "plate" },
  { id: "c-kultur", name: "Культура", is_main: true, icon: "ticket" },
  { id: "c-musik", name: "Музыка", is_main: true, icon: "note" },
  { id: "c-reisen", name: "Поездки", is_main: true, icon: "globe" },
  { id: "c-spiele", name: "Игры", is_main: true, icon: "cards" },

  { id: "c-kino", name: "Кино", is_main: false, icon: "ticket" },
  { id: "c-wandern", name: "Походы", is_main: false, icon: "place" },
  { id: "c-kochen", name: "Готовка", is_main: false, icon: "plate" },
  { id: "c-foto", name: "Фотография", is_main: false, icon: "camera" },
  { id: "c-sprachen", name: "Языковой обмен", is_main: false, icon: "globe" },
  { id: "c-gaming", name: "Гейминг", is_main: false, icon: "cards" },
  { id: "c-karriere", name: "Карьера", is_main: false, icon: "briefcase" },
  { id: "c-ehrenamt", name: "Волонтёрство", is_main: false, icon: "heart" },
  { id: "c-mitfahren", name: "Попутчики", is_main: false, icon: "bike" },
  { id: "c-flohmarkt", name: "Барахолка", is_main: false, icon: "sparkle" },
  { id: "c-fahrrad", name: "Велосипед", is_main: false, icon: "bike" },
  { id: "c-schwimmen", name: "Плавание", is_main: false, icon: "sparkle" },
];

export const mainCategories = categories.filter((c) => c.is_main);
export const otherCategories = categories.filter((c) => !c.is_main);
export const categoryById = new Map(categories.map((c) => [c.id, c]));
