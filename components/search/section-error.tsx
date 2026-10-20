import { Icon } from "@/components/ui/icon";

/** Ошибка целой секции листа «Фильтры» — под полями, а не у одного из них. */
export function SectionError({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-1.5 text-[12px] leading-snug text-heat" role="alert">
      <Icon name="close" size={12} className="mt-0.5 shrink-0" />
      {children}
    </p>
  );
}
