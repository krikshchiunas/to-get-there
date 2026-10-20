"use client";

import { RadioRow } from "@/components/ui/field";
import { toChatAccess } from "@/lib/idea-draft";
import type { ChatAccess, IconName } from "@/lib/types";

const options: ReadonlyArray<{ value: ChatAccess; label: string; description: string; icon: IconName }> = [
  {
    value: "everyone",
    label: "Все",
    description: "Любой, кто увидит идею, может открыть чат.",
    icon: "chat",
  },
  {
    value: "followers",
    label: "Только подписчики",
    description: "Только те, кто на тебя подписан.",
    icon: "person",
  },
  {
    value: "friends",
    label: "Только друзья",
    description: "Только те, на кого ты подписан и кто подписан на тебя.",
    icon: "lock",
  },
];

/** Кто пишет в чате идеи. Видят идею все — это решение только про чат. */
export function ChatAccessPicker({
  value,
  onChange,
}: {
  value: ChatAccess;
  onChange: (next: ChatAccess) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Кто может зайти в чат" className="space-y-2">
      {options.map((option) => (
        <RadioRow
          key={option.value}
          name="create-chat-access"
          value={option.value}
          checked={value === option.value}
          onChange={(raw) => onChange(toChatAccess(raw))}
          label={option.label}
          description={option.description}
          icon={option.icon}
        />
      ))}
    </div>
  );
}
