"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { Verified } from "@/components/ui/verified";
import type { ModeratorPermissions, ParticipantView } from "@/lib/types";

const noRights: ModeratorPermissions = {
  can_post_media: false,
  can_pin: false,
  can_poll: false,
  can_kick: false,
};

/**
 * Author only. Moderator rights are granted per person, and closing the
 * sign-up is the one action here that changes the idea itself.
 *
 * Каждый модератор — строка списка с переключателями под ней, разделённая
 * линией. Раньше это были карточки в рамках: четыре рамки на один экран
 * настроек читались тяжелее, чем сами настройки.
 */
export function ModerationSheet({
  open,
  onClose,
  moderators,
  isClosed,
  onPermissionChange,
  onCloseSignup,
  onOpenParticipants,
}: {
  open: boolean;
  onClose: () => void;
  moderators: ParticipantView[];
  isClosed: boolean;
  onPermissionChange: (userId: string, permissions: ModeratorPermissions) => void;
  onCloseSignup: () => void;
  onOpenParticipants: () => void;
}) {
  const [confirmClose, setConfirmClose] = useState(false);

  return (
    <Sheet open={open} onClose={onClose} title="Модерация">
      <div className="space-y-6">
        <section>
          <h3 className="text-[13px] font-medium text-ink-faint">Права модераторов</h3>
          <p className="mt-1 text-[14px] leading-[1.5] text-ink-soft">
            Каждое право выдаётся отдельно. Что выключено здесь, того человек в чате даже не
            увидит.
          </p>

          {moderators.length === 0 ? (
            <div className="mt-3">
              <p className="text-[14px] leading-[1.5] text-ink-soft">
                Эту идею пока никто не модерирует. Сделать модератором можно в списке
                участников.
              </p>
              <Button
                type="button"
                variant="quiet"
                size="sm"
                className="mt-3"
                onClick={onOpenParticipants}
              >
                Открыть участников
              </Button>
            </div>
          ) : (
            <div className="u-feed mt-2">
              {moderators.map((moderator) => {
                const permissions = moderator.permissions ?? noRights;
                const { user } = moderator;

                return (
                  <div key={moderator.id} className="u-feed-divider pt-3 pb-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar user={user} size="sm" />
                      <span className="truncate text-[15px] font-medium">{user.nickname}</span>
                      {user.is_verified ? <Verified size={13} /> : null}
                    </div>

                    <div className="mt-1">
                      <Switch
                        label="Отправлять изображения"
                        checked={permissions.can_post_media}
                        onChange={(next) =>
                          onPermissionChange(user.id, { ...permissions, can_post_media: next })
                        }
                      />
                      <Switch
                        label="Закреплять сообщения"
                        checked={permissions.can_pin}
                        onChange={(next) =>
                          onPermissionChange(user.id, { ...permissions, can_pin: next })
                        }
                      />
                      <Switch
                        label="Создавать голосования"
                        checked={permissions.can_poll}
                        onChange={(next) =>
                          onPermissionChange(user.id, { ...permissions, can_poll: next })
                        }
                      />
                      <Switch
                        label="Удалять из чата"
                        checked={permissions.can_kick}
                        onChange={(next) =>
                          onPermissionChange(user.id, { ...permissions, can_kick: next })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="border-t border-line pt-5">
          <h3 className="text-[13px] font-medium text-ink-faint">Закрыть набор</h3>
          <p className="mt-1 text-[14px] leading-[1.5] text-ink-soft">
            Идея исчезнет из ленты, присоединиться больше нельзя. Чат остаётся открытым для
            всех, кто уже в нём.
          </p>

          {isClosed ? (
            <p className="mt-3 flex items-center gap-1.5 text-[14px]">
              <Icon name="check" size={16} className="text-verified" />
              Набор закрыт.
            </p>
          ) : confirmClose ? (
            <div className="u-rise mt-3">
              <p className="text-[14px] leading-[1.5]">Точно? Обратно это здесь не вернуть.</p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    onCloseSignup();
                    setConfirmClose(false);
                  }}
                >
                  Закрыть набор
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClose(false)}
                >
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="mt-3"
              onClick={() => setConfirmClose(true)}
            >
              Закрыть набор
            </Button>
          )}
        </section>
      </div>
    </Sheet>
  );
}
