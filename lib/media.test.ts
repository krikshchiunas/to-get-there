import { describe, expect, it } from "vitest";
import {
  avatarPathFromUrl,
  avatarPublicUrl,
  chatMediaPath,
  isChatMediaPath,
  isOwnAvatarUrl,
} from "./media";

const BASE = "https://abc.supabase.co";
const USER = "3c77304a-29bc-4617-b9b2-7085efb7bea0";
const OTHER = "33333333-3333-3333-3333-000000000002";
const POST = "44444444-4444-4444-4444-000000000001";
const FILE = "843f530a-b80f-45a6-97ad-fbab04180b47";

describe("isOwnAvatarUrl", () => {
  const own = avatarPublicUrl(BASE, `${USER}/${FILE}.webp`);

  it("пропускает свой аватар из нашего хранилища", () => {
    expect(isOwnAvatarUrl(own, BASE, USER)).toBe(true);
  });

  it("не пропускает внешний адрес — пиксель слежения не пройдёт", () => {
    expect(isOwnAvatarUrl("https://tracker.example/p.gif", BASE, USER)).toBe(false);
  });

  it("не пропускает чужую папку", () => {
    expect(isOwnAvatarUrl(avatarPublicUrl(BASE, `${OTHER}/${FILE}.webp`), BASE, USER)).toBe(false);
  });

  it("не пропускает выход из папки и вложенные пути", () => {
    expect(isOwnAvatarUrl(avatarPublicUrl(BASE, `${USER}/../${OTHER}/${FILE}.webp`), BASE, USER)).toBe(false);
    expect(isOwnAvatarUrl(avatarPublicUrl(BASE, `${USER}/x/${FILE}.webp`), BASE, USER)).toBe(false);
  });

  it("не пропускает чужой хост с похожим началом", () => {
    const lookalike = own.replace("abc.supabase.co", "abc.supabase.co.evil.example");
    expect(isOwnAvatarUrl(lookalike, BASE, USER)).toBe(false);
  });

  it("не пропускает запрос и якорь после имени", () => {
    expect(isOwnAvatarUrl(`${own}?x=1`, BASE, USER)).toBe(false);
    expect(isOwnAvatarUrl(`${own}#x`, BASE, USER)).toBe(false);
  });

  it("не пропускает другие расширения", () => {
    expect(isOwnAvatarUrl(avatarPublicUrl(BASE, `${USER}/${FILE}.svg`), BASE, USER)).toBe(false);
  });
});

describe("isChatMediaPath", () => {
  it("пропускает файл в папке своей идеи", () => {
    expect(isChatMediaPath(chatMediaPath(POST, FILE, "webp"), POST)).toBe(true);
  });

  it("не пропускает файл из другой идеи", () => {
    const otherPost = "44444444-4444-4444-4444-000000000002";
    expect(isChatMediaPath(chatMediaPath(otherPost, FILE, "webp"), POST)).toBe(false);
  });

  it("не пропускает ссылки, выход из папки и svg", () => {
    expect(isChatMediaPath(`https://x.example/${POST}/${FILE}.webp`, POST)).toBe(false);
    expect(isChatMediaPath(`${POST}/../${FILE}.webp`, POST)).toBe(false);
    expect(isChatMediaPath(`${POST}/${FILE}.svg`, POST)).toBe(false);
  });

  it("не принимает идею с битым id — регулярка не собирается из мусора", () => {
    expect(isChatMediaPath(`.*/${FILE}.webp`, ".*")).toBe(false);
  });
});

describe("avatarPathFromUrl", () => {
  it("достаёт путь внутри бакета", () => {
    expect(avatarPathFromUrl(avatarPublicUrl(BASE, `${USER}/${FILE}.webp`), BASE)).toBe(`${USER}/${FILE}.webp`);
  });

  it("на чужой ссылке возвращает null", () => {
    expect(avatarPathFromUrl("https://x.example/a.webp", BASE)).toBeNull();
  });
});
