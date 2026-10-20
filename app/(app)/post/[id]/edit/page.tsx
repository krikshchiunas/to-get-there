import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreateForm } from "@/components/create/create-form";
import { PageHeader } from "@/components/ui/page-header";
import { getCategories, getCitiesWithPosts, getPost } from "@/lib/data";

export const metadata: Metadata = {
  title: "Правка идеи",
};

/** Проверка «время в будущем» зависит от часов. */
export const dynamic = "force-dynamic";

type EditPageProps = { params: Promise<{ id: string }> };

/**
 * Правка идеи — та же форма, что «Новая идея», с заполненными полями.
 * Чужую идею здесь не открыть: для не-автора страницы нет, а запись всё
 * равно отклонила бы политика posts_update_author.
 */
export default async function EditIdeaPage({ params }: EditPageProps) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post || post.viewer_role !== "author") notFound();

  const now = new Date();
  const [categories, cities] = await Promise.all([getCategories(), getCitiesWithPosts()]);

  return (
    <>
      <PageHeader title="Правка идеи" subtitle={post.title} backHref={`/post/${post.id}`} />
      <CreateForm now={now} viewer={post.author} categories={categories} cities={cities} editing={post} />
    </>
  );
}
