"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";

/**
 * Ошибка внутри страницы. Оболочка с навигацией остаётся — человек может
 * уйти на другой экран, а не смотреть в белый лист. Подробности ошибки
 * наружу не показываются: digest — номер, по которому её найти в журнале
 * (instrumentation.ts).
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="pt-6">
      <EmptyState
        icon="warning"
        title="Что-то пошло не так"
        body={
          error.digest
            ? `Мы уже видим эту ошибку в журнале. Попробуй ещё раз — обычно помогает. Код: ${error.digest}`
            : "Попробуй ещё раз — обычно помогает. Если повторится, обнови страницу."
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" size="md" onClick={reset}>
              Попробовать снова
            </Button>
            <ButtonLink href="/" variant="quiet" size="md">
              К идеям
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
