"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePost } from "@/app/actions/posts";
import { ActionSheet, ConfirmSheet, type SheetAction } from "@/components/ui/action-sheet";
import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/components/ui/toast";
import { ReportSheet } from "@/components/safety/report-sheet";
import type { PostView } from "@/lib/types";

type Open = "menu" | "delete" | "report" | null;

/**
 * «⋯» в шапке идеи. Автору — править и удалить идею (закрыть набор живёт в
 * листе модерации). Остальным — пожаловаться.
 */
export function IdeaMenu({ post, isAuthor }: { post: PostView; isAuthor: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deletePost(post.id);
      if (!result.ok) {
        setOpen(null);
        notify(result.error);
        return;
      }
      notify("Идея удалена.", "info");
      router.replace("/");
    });
  }

  const actions: SheetAction[] = isAuthor
    ? [
        { label: "Редактировать идею", icon: "note", onSelect: () => router.push(`/post/${post.id}/edit`) },
        { label: "Удалить идею", icon: "trash", danger: true, onSelect: () => setOpen("delete") },
      ]
    : [{ label: "Пожаловаться на идею", icon: "flag", danger: true, onSelect: () => setOpen("report") }];

  return (
    <>
      <IconButton
        type="button"
        label="Ещё об идее"
        aria-haspopup="dialog"
        aria-expanded={open === "menu"}
        onClick={() => setOpen("menu")}
      >
        <Icon name="more" size={19} />
      </IconButton>

      <ActionSheet open={open === "menu"} onClose={() => setOpen(null)} title={post.title} actions={actions} />

      {isAuthor ? (
        <ConfirmSheet
          open={open === "delete"}
          onClose={() => setOpen(null)}
          title="Удалить идею?"
          confirmLabel="Удалить идею"
          onConfirm={remove}
          pending={pending}
        >
          <p>Идея исчезнет из ленты, а вместе с ней чат, голосования и фото. Участники больше не смогут туда зайти.</p>
          <p>Если просто больше никого не ждёшь — лучше закрой набор: чат тогда останется.</p>
        </ConfirmSheet>
      ) : open === "report" ? (
        <ReportSheet open onClose={() => setOpen(null)} targetType="post" targetId={post.id} subject={`«${post.title}»`} />
      ) : null}
    </>
  );
}
