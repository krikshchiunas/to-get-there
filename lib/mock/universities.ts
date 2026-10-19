import type { University } from "@/lib/types";

/**
 * Official names in Russian; `short_name` keeps the form students actually
 * use in conversation. `domain` is what the university-mail verification
 * will check at the final stage.
 */
export const universities: University[] = [
  {
    id: "u-tub",
    name: "Технический университет Берлина",
    domain: "tu-berlin.de",
    city: "Берлин",
    country: "Германия",
    campus_lat: 52.5125,
    campus_lng: 13.3269,
    short_name: "TU Berlin",
  },
  {
    id: "u-hub",
    name: "Берлинский университет имени Гумбольдта",
    domain: "hu-berlin.de",
    city: "Берлин",
    country: "Германия",
    campus_lat: 52.518,
    campus_lng: 13.3934,
    short_name: "HU Berlin",
  },
  {
    id: "u-fub",
    name: "Свободный университет Берлина",
    domain: "fu-berlin.de",
    city: "Берлин",
    country: "Германия",
    campus_lat: 52.4524,
    campus_lng: 13.2899,
    short_name: "FU Berlin",
  },
  {
    id: "u-lmu",
    name: "Мюнхенский университет Людвига-Максимилиана",
    domain: "lmu.de",
    city: "Мюнхен",
    country: "Германия",
    campus_lat: 48.1508,
    campus_lng: 11.5805,
    short_name: "LMU",
  },
  {
    id: "u-uhh",
    name: "Гамбургский университет",
    domain: "uni-hamburg.de",
    city: "Гамбург",
    country: "Германия",
    campus_lat: 53.5668,
    campus_lng: 9.9847,
    short_name: "Uni Hamburg",
  },
  {
    id: "u-rwth",
    name: "Ахенский технический университет",
    domain: "rwth-aachen.de",
    city: "Ахен",
    country: "Германия",
    campus_lat: 50.7779,
    campus_lng: 6.0778,
    short_name: "RWTH",
  },
  {
    id: "u-kit",
    name: "Технологический институт Карлсруэ",
    domain: "kit.edu",
    city: "Карлсруэ",
    country: "Германия",
    campus_lat: 49.0094,
    campus_lng: 8.412,
    short_name: "KIT",
  },
  {
    id: "u-koeln",
    name: "Кёльнский университет",
    domain: "uni-koeln.de",
    city: "Кёльн",
    country: "Германия",
    campus_lat: 50.9281,
    campus_lng: 6.9289,
    short_name: "Uni Köln",
  },
];

export const universityById = new Map(universities.map((u) => [u.id, u]));
