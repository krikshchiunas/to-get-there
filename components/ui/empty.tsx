import type { ReactNode } from "react";
import type { IconName } from "@/lib/types";
import { Icon } from "./icon";

/** An empty screen is an invitation to act, so it always carries the action. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-sunken text-ink-faint">
        <Icon name={icon} size={22} />
      </span>
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-[32ch] text-sm text-ink-soft">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
