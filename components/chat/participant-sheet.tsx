"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { TimeFromNow } from "@/components/ui/time-from-now";
import { Verified } from "@/components/ui/verified";
import type { ChatRole, ParticipantView } from "@/lib/types";
import { RoleMarker } from "./message-list";

const roleOrder: Record<ChatRole, number> = {
  author: 0,
  moderator: 1,
  participant: 2,
  guest: 3,
};

/**
 * Who is in this idea chat. The author may appoint moderators and remove
 * people; a moderator with `can_kick` may remove. Removing asks first.
 *
 * Список людей — такая же строка, как в ленте: аватар, ник, служебная
 * строка снизу, разделение линией. Ни рамок, ни второго фона.
 */
export function ParticipantSheet({
  open,
  onClose,
  participants,
  viewerId,
  isAuthor,
  canKick,
  onRemove,
  onSetModerator,
}: {
  open: boolean;
  onClose: () => void;
  participants: ParticipantView[];
  viewerId: string;
  isAuthor: boolean;
  canKick: boolean;
  onRemove: (userId: string) => void;
  onSetModerator: (userId: string, moderator: boolean) => void;
}) {
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<string | null>(null);

  const rows = [...participants].sort(
    (a, b) => roleOrder[a.role] - roleOrder[b.role] || a.joined_at.localeCompare(b.joined_at),
  );

  function toggleRow(id: string) {
    setConfirmRow(null);
    setOpenRow((previous) => (previous === id ? null : id));
  }

  return (
    <Sheet open={open} onClose={onClose} title="Участники">
      {rows.length === 0 ? (
        <EmptyState
          icon="person"
          title="Пока никого нет"
          body="Здесь появятся все, кто присоединится к идее."
        />
      ) : (
        <ul className="u-feed">
          {rows.map((participant) => {
            const { user, role } = participant;
            const isSelf = user.id === viewerId;
            const mayRemove = (isAuthor || canKick) && !isSelf && role !== "author";
            const mayAppoint = isAuthor && !isSelf && role !== "author";
            const hasActions = mayRemove || mayAppoint;
            const expanded = openRow === participant.id;

            return (
              <li key={participant.id} className="u-feed-divider">
                <div className="flex items-center gap-3 px-1 py-3">
                  <Link
                    href={`/u/${user.nickname}`}
                    onClick={onClose}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Avatar user={user} size="md" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        <span className="truncate text-[15px] font-medium">{user.nickname}</span>
                        {user.is_verified ? <Verified size={13} /> : null}
                        <RoleMarker role={role} />
                        {isSelf ? <span className="text-[13px] text-ink-soft">ты</span> : null}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-ink-soft">
                        В чате с <TimeFromNow value={participant.joined_at} mode="stamp" />
                      </span>
                    </span>
                  </Link>

                  {hasActions ? (
                    <IconButton
                      type="button"
                      variant="ghost"
                      label={`Действия для ${user.nickname}`}
                      aria-expanded={expanded}
                      onClick={() => toggleRow(participant.id)}
                    >
                      <Icon name="more" size={18} />
                    </IconButton>
                  ) : null}
                </div>

                {hasActions && expanded ? (
                  <div className="u-rise flex flex-col items-start gap-2 px-1 pb-3">
                    {mayAppoint ? (
                      <Button
                        type="button"
                        variant="quiet"
                        size="sm"
                        onClick={() => {
                          onSetModerator(user.id, role !== "moderator");
                          setOpenRow(null);
                        }}
                      >
                        <Icon name="shield" size={15} />
                        {role === "moderator" ? "Снять модератора" : "Сделать модератором"}
                      </Button>
                    ) : null}

                    {mayRemove && confirmRow !== participant.id ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => setConfirmRow(participant.id)}
                      >
                        Удалить из чата
                      </Button>
                    ) : null}

                    {mayRemove && confirmRow === participant.id ? (
                      <div className="u-rise w-full rounded-field bg-sunken p-3.5">
                        <p className="text-[14px] leading-[1.5]">
                          Удалить {user.nickname} из чата? Читать и писать здесь будет нельзя.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              onRemove(user.id);
                              setConfirmRow(null);
                              setOpenRow(null);
                            }}
                          >
                            Удалить из чата
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmRow(null)}
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
