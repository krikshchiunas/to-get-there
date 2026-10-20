"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { updateAvatar } from "@/app/actions/settings";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/components/ui/toast";
import { uploadAvatar } from "@/lib/upload";
import type { UserView } from "@/lib/types";

/**
 * Фото профиля сохраняется сразу после загрузки, отдельно от формы: ждать
 * «Сохранить» ради картинки, которая уже видна, было бы странно.
 */
export function AvatarPicker({ user }: { user: UserView }) {
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function apply(next: string | null) {
    const result = await updateAvatar(next);
    if (!result.ok) {
      notify(result.error);
      return false;
    }
    setAvatarUrl(next);
    return true;
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const upload = await uploadAvatar(file, user.id);
      if (!upload.ok) {
        notify(upload.error);
        return;
      }
      if (await apply(upload.value)) notify("Фото обновлено.", "info");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      if (await apply(null)) notify("Фото убрано.", "info");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Avatar user={{ ...user, avatar_url: avatarUrl }} size="lg" withBadge />

      <div className="min-w-0">
        <p className="text-[15px]">Фото профиля</p>
        <p className="mt-1 text-[14px] leading-[1.4] text-ink-soft">
          {avatarUrl
            ? "Видно всем, кто видит твой профиль. Данные о месте съёмки из фото удаляются."
            : "Пока вместо фото — инициалы ника. JPG, PNG, WebP или GIF; место съёмки из фото удаляется."}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={handleFile}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="quiet"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="image" size={15} />
            {busy ? "Загружаем…" : avatarUrl ? "Заменить фото" : "Загрузить фото"}
          </Button>
          {avatarUrl ? (
            <Button type="button" variant="quiet" size="sm" disabled={busy} onClick={handleRemove}>
              Убрать
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
