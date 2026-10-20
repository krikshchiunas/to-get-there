import type { ChatAccess, ChatRole, GeoMode, GeoRadius, PostView } from "@/lib/types";
import { categoryById } from "./categories";
import { userById } from "./users";
import { at, hoursAgo, nextWeekday } from "./time";

type Seed = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  category_id: string;
  date_start: string;
  city: string;
  address?: string;
  lat?: number;
  lng?: number;
  geo_mode?: GeoMode;
  radius?: GeoRadius;
  max?: number;
  closed?: boolean;
  access?: ChatAccess;
  participants: number;
  role?: ChatRole;
  created_hours_ago?: number;
};

function build(seed: Seed): PostView {
  const author = userById.get(seed.author_id);
  if (!author) throw new Error(`Unknown author: ${seed.author_id}`);
  const category = categoryById.get(seed.category_id);
  if (!category) throw new Error(`Unknown category: ${seed.category_id}`);

  return {
    id: seed.id,
    author_id: seed.author_id,
    title: seed.title,
    description: seed.description,
    category_id: seed.category_id,
    date_start: seed.date_start,
    geo_lat: seed.lat ?? null,
    geo_lng: seed.lng ?? null,
    geo_city: seed.city,
    geo_address: seed.address ?? null,
    geo_mode: seed.geo_mode ?? (seed.address ? "area" : "city"),
    geo_radius_m: seed.radius ?? null,
    max_participants: seed.max ?? null,
    is_closed: seed.closed ?? false,
    chat_access: seed.access ?? "everyone",
    // The university is taken from the author's profile and is not editable.
    university_id: author.university_id,
    created_at: hoursAgo(seed.created_hours_ago ?? 20),
    author,
    university: author.university,
    category,
    participant_count: seed.participants,
    viewer_role: seed.role ?? "guest",
  };
}

const seeds: Seed[] = [
  {
    id: "p-kanal",
    author_id: "u-jonas",
    title: "Пиво у канала после занятий",
    description:
      "После последней лекции идём на Ландверканал: напитки из ларька, ноги в траве. Кто подтянется позже, просто напишите в чат, и я скажу, где мы сидим.",
    category_id: "c-feiern",
    date_start: at(0, 19, 30),
    city: "Берлин",
    address: "Landwehrkanal, Kreuzberg",
    lat: 52.4951,
    lng: 13.4216,
    geo_mode: "area",
    max: 8,
    participants: 5,
    role: "participant",
    created_hours_ago: 6,
  },
  {
    id: "p-analysis",
    author_id: "u-mira",
    title: "Учебная группа по анализу перед экзаменом",
    description:
      "Разбираем задачи с экзаменов 2023 и 2024 годов, упор на интегральные теоремы. Приносите свои попытки решений: объяснить другому — половина подготовки. Аудитория забронирована.",
    category_id: "c-lernen",
    date_start: at(1, 10, 0),
    city: "Берлин",
    address: "TU Berlin, Mathegebäude, Raum MA 041",
    lat: 52.5131,
    lng: 13.3265,
    geo_mode: "area",
    max: 6,
    participants: 4,
    role: "moderator",
    access: "everyone",
    created_hours_ago: 30,
  },
  {
    id: "p-mensa",
    author_id: "u-tobi",
    title: "Обед в столовой для первокурсников",
    description:
      "Первый семестр, никто никого не знает. Встречаемся у входа, потом занимаем большой стол. Записываться не нужно, просто приходите.",
    category_id: "c-essen",
    date_start: at(0, 12, 30),
    city: "Берлин",
    address: "Mensa TU, Hardenbergstraße",
    lat: 52.5119,
    lng: 13.3274,
    geo_mode: "area",
    participants: 11,
    created_hours_ago: 26,
  },
  {
    id: "p-ostbloc",
    author_id: "me",
    title: "Боулдеринг в Ostbloc, новички тоже",
    description:
      "Сама лажу всего два месяца, так что никакого давления. Скальники можно взять на месте, дневной билет со студенческим — 11 евро.",
    category_id: "c-sport",
    date_start: at(0, 18, 0),
    city: "Берлин",
    address: "Ostbloc, Hauptstraße 13",
    lat: 52.5008,
    lng: 13.4745,
    geo_mode: "area",
    max: 4,
    participants: 3,
    role: "author",
    created_hours_ago: 9,
  },
  {
    id: "p-datenbanken",
    author_id: "u-kwame",
    title: "Обмен конспектами по базам данных",
    description:
      "У меня есть лекции с первой по седьмую, не хватает восьмой и девятой. Садимся в библиотеке, сверяем и закрываем пробелы. Возьмите ноутбук.",
    category_id: "c-lernen",
    date_start: at(0, 16, 0),
    city: "Берлин",
    address: "Universitätsbibliothek TU, 3. OG",
    lat: 52.5107,
    lng: 13.3297,
    geo_mode: "area",
    participants: 2,
    created_hours_ago: 11,
  },
  {
    id: "p-tempelhof",
    author_id: "u-paul",
    title: "Футбол на Темпельхофер Фельд",
    description:
      "Две команды, спокойная игра, потом пиво на газоне. Нужны ещё люди, уровень правда не важен. Цвет футболки: какая чистая.",
    category_id: "c-sport",
    date_start: nextWeekday(6, 15, 0),
    city: "Берлин",
    address: "Tempelhofer Feld, Eingang Oderstraße",
    lat: 52.4749,
    lng: 13.4216,
    geo_mode: "area",
    max: 14,
    participants: 9,
    created_hours_ago: 40,
  },
  {
    id: "p-sisyphos",
    author_id: "u-jonas",
    title: "Первый раз в Sisyphos, идём вместе",
    description:
      "Для тех, кто ещё не был и не хочет стоять в очереди один. Собираемся заранее у станции, заходим вместе, а кто захочет уйти — уходит.",
    category_id: "c-feiern",
    date_start: nextWeekday(5, 23, 30),
    city: "Берлин",
    address: "S Rummelsburg, встреча у выхода",
    lat: 52.4983,
    lng: 13.4876,
    geo_mode: "area",
    max: 6,
    participants: 6,
    access: "followers",
    created_hours_ago: 70,
  },
  {
    id: "p-tandem",
    author_id: "u-yara",
    title: "Языковой обмен: немецкий и испанский",
    description:
      "Час немецкого, час испанского, между ними пирог. Ищу человека, с которым это получится регулярно, а не один раз.",
    category_id: "c-sprachen",
    date_start: nextWeekday(3, 17, 0),
    city: "Гамбург",
    address: "Café Nord, Grindelallee",
    lat: 53.5673,
    lng: 9.9816,
    geo_mode: "area",
    max: 2,
    participants: 1,
    created_hours_ago: 48,
  },
  {
    id: "p-brettspiele",
    author_id: "u-elif",
    title: "Вечер настольных игр в общаге",
    description:
      "Wingspan, Azul, а если наберётся достаточно людей — «Мафия». Снеки есть, напитки берите с собой. Адрес напишу в чате.",
    category_id: "c-spiele",
    date_start: at(1, 19, 0),
    city: "Берлин",
    address: "Квартира в Веддинге, адрес в чате",
    geo_mode: "city",
    max: 7,
    participants: 5,
    access: "friends",
    created_hours_ago: 22,
  },
  {
    id: "p-leipzig",
    author_id: "u-felix",
    title: "Попутчики Мюнхен — Лейпциг",
    description:
      "Пятница, после обеда, три места свободно, 20 евро с человека на бензин. Еду через Нюрнберг и Йену, остановки по пути не проблема.",
    category_id: "c-mitfahren",
    date_start: nextWeekday(5, 16, 0),
    city: "Мюнхен",
    address: "Выезд от Studentenstadt, Freimann",
    lat: 48.1808,
    lng: 11.6109,
    geo_mode: "area",
    max: 3,
    participants: 2,
    created_hours_ago: 15,
  },
  {
    id: "p-sonnenaufgang",
    author_id: "u-nina",
    title: "Фотопрогулка на рассвете",
    description:
      "Обербаумбрюкке, около шести, пока не начался транспорт. Плёнка или цифра — совершенно неважно. Потом кофе, если уже откроются.",
    category_id: "c-foto",
    date_start: at(1, 6, 30),
    city: "Берлин",
    address: "Oberbaumbrücke, сторона Фридрихсхайна",
    lat: 52.5021,
    lng: 13.4459,
    geo_mode: "area",
    max: 4,
    participants: 2,
    created_hours_ago: 20,
  },
  {
    id: "p-pubquiz",
    author_id: "u-kwame",
    title: "Паб-квиз на английском, нужна команда",
    description:
      "Нас трое, не хватает двух голов, желательно с музыкой и географией. На прошлой неделе были четвёртыми, хочется выше.",
    category_id: "c-spiele",
    date_start: nextWeekday(4, 20, 0),
    city: "Берлин",
    address: "The Castle, Invalidenstraße",
    lat: 52.5283,
    lng: 13.3853,
    geo_mode: "area",
    max: 5,
    participants: 3,
    created_hours_ago: 34,
  },
  {
    id: "p-schwimmen",
    author_id: "u-marta",
    title: "Плавание перед первой лекцией",
    description:
      "В воде в половине седьмого, в полвосьмого уже на выходе, как раз к началу занятий. Мне хватит двух человек, которые правда будут приходить.",
    category_id: "c-schwimmen",
    date_start: at(1, 6, 30),
    city: "Ахен",
    address: "Schwimmhalle Süd",
    lat: 50.7596,
    lng: 6.0864,
    geo_mode: "area",
    max: 3,
    participants: 1,
    created_hours_ago: 18,
  },
  {
    id: "p-maultaschen",
    author_id: "u-dennis",
    title: "Готовим вместе: пельмени вручную",
    description:
      "Тесто, начинка, всё своими руками, уходит часа три, зато потом вкуснее. Продукты принесу я, расходы поделим.",
    category_id: "c-kochen",
    date_start: nextWeekday(6, 18, 30),
    city: "Кёльн",
    address: "Кухня в общежитии Efferen",
    geo_mode: "city",
    max: 6,
    participants: 4,
    created_hours_ago: 52,
  },
  {
    id: "p-lesekreis",
    author_id: "u-ayse",
    title: "Читательский клуб: Кафка на немецком",
    description:
      "На этой неделе первая половина «Превращения». Читаем медленно и вслух, даже если немецкий не первый язык. Клуб как раз для этого.",
    category_id: "c-kultur",
    date_start: nextWeekday(2, 18, 0),
    city: "Берлин",
    address: "HU Hauptgebäude, Raum 2093",
    lat: 52.5181,
    lng: 13.3935,
    geo_mode: "area",
    max: 8,
    participants: 6,
    role: "participant",
    created_hours_ago: 60,
  },
  {
    id: "p-schlachtensee",
    author_id: "u-svenja",
    title: "Гриль на Шлахтензее к началу семестра",
    description:
      "Гриль есть, берите с собой то, что на него положите. Мы на северном берегу, пледы будут, музыка тихая. С собаками можно.",
    category_id: "c-essen",
    date_start: nextWeekday(7, 13, 0),
    city: "Берлин",
    address: "Schlachtensee, Nordufer",
    lat: 52.4381,
    lng: 13.2024,
    geo_mode: "area",
    max: 20,
    participants: 12,
    created_hours_ago: 44,
  },
  {
    id: "p-liepnitz",
    author_id: "u-svenja",
    title: "Поход вокруг Липницзее",
    description:
      "На электричке до Бернау, потом вокруг озера, около одиннадцати километров. Мы уже в полном составе, чат остаётся для договорённостей.",
    category_id: "c-wandern",
    date_start: nextWeekday(7, 9, 0),
    city: "Берлин",
    address: "S Bernau, встреча на первом пути",
    lat: 52.6794,
    lng: 13.5872,
    geo_mode: "area",
    max: 10,
    participants: 10,
    closed: true,
    created_hours_ago: 72,
  },
  {
    id: "p-festsaal",
    author_id: "u-ayse",
    title: "Концерт в Festsaal Kreuzberg",
    description: "Было громко и хорошо. Чат остаётся открытым, если кто-то ещё хочет выложить фотографии.",
    category_id: "c-musik",
    date_start: at(-1, 20, 0),
    city: "Берлин",
    address: "Festsaal Kreuzberg, Am Flutgraben",
    lat: 52.4993,
    lng: 13.4489,
    geo_mode: "area",
    max: 6,
    participants: 6,
    role: "participant",
    created_hours_ago: 96,
  },
  {
    id: "p-hockey",
    author_id: "u-marta",
    title: "Тренировка по хоккею, можно присоединиться",
    description:
      "По вторникам тренируется университетская группа, новички могут просто побегать вместе. Клюшки есть, щитки лучше свои.",
    category_id: "c-sport",
    date_start: nextWeekday(2, 19, 30),
    city: "Ахен",
    address: "Sportzentrum Königshügel",
    lat: 50.7753,
    lng: 6.0689,
    geo_mode: "radius",
    radius: 2000,
    max: 12,
    participants: 7,
    created_hours_ago: 28,
  },
  {
    id: "p-flohmarkt",
    author_id: "me",
    title: "Барахолка в Мауэрпарке, потом кофе",
    description:
      "Мне нужны лампа и полка, остальное просто посмотрю. Кто пойдёт со мной, получит напарника для торга. Встречаемся у главного входа.",
    category_id: "c-flohmarkt",
    date_start: nextWeekday(7, 11, 0),
    city: "Берлин",
    address: "Mauerpark, вход с Bernauer Straße",
    lat: 52.5411,
    lng: 13.4026,
    geo_mode: "radius",
    radius: 1000,
    max: 5,
    participants: 2,
    role: "author",
    created_hours_ago: 5,
  },
];

export const posts: PostView[] = seeds.map(build);
export const postById = new Map(posts.map((p) => [p.id, p]));
