import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";

export const metadata: Metadata = {
  title: "Страница не найдена",
};

export default function NotFound() {
  return (
    <div className="pt-6">
      <EmptyState
        icon="search"
        title="Такой страницы нет"
        body="Проверь ссылку: возможно, в ней ошибка или автор закрыл набор. В ленте — ближайшие идеи."
        action={
          <ButtonLink href="/" size="md">
            К идеям
          </ButtonLink>
        }
      />
    </div>
  );
}
