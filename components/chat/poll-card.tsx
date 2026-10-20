"use client";

import { Icon } from "@/components/ui/icon";
import { TimeFromNow } from "@/components/ui/time-from-now";
import { pluralRu } from "@/lib/format";
import type { PollView } from "@/lib/types";

/**
 * A poll in the stream. Results are visible to everyone, always — there is no
 * hidden tally and no "vote to see". Voting moves the viewer's single vote.
 *
 * Варианты — строки с полосой заполнения, а не поля в рамках: доля видна
 * длиной полосы, выбор — галочкой, и на экране не появляется ещё шесть линий.
 */
export function PollCard({
  poll,
  canVote,
  onVote,
}: {
  poll: PollView;
  canVote: boolean;
  onVote: (optionIndex: number) => void;
}) {
  const total = poll.total_votes;

  return (
    <div className="rounded-card bg-sunken p-3.5">
      <div className="flex items-center gap-1.5 text-[12px] text-ink-soft">
        <Icon name="poll" size={14} className="shrink-0 text-ink-faint" />
        <span className="min-w-0 truncate">Голосование от {poll.author.nickname}</span>
        <TimeFromNow value={poll.created_at} mode="stamp" className="u-tnum ml-auto shrink-0" />
      </div>

      <p className="mt-2 text-[15px] leading-snug font-medium">{poll.question}</p>

      <ul className="mt-2.5 space-y-1">
        {poll.options.map((option, index) => {
          const votes = poll.tally[index] ?? 0;
          const percent = total === 0 ? 0 : Math.round((votes / total) * 100);
          const chosen = poll.viewer_choice === index;

          const rowClass = [
            "relative flex min-h-10 w-full items-center gap-2 overflow-hidden rounded-field px-2.5 py-2 text-left transition-colors",
            canVote && !chosen ? "hover:bg-signal/8" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const inner = (
            <>
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-signal/12"
                style={{ width: `${percent}%` }}
              />
              {chosen ? (
                <Icon name="check" size={16} className="relative shrink-0 text-signal" />
              ) : (
                <span aria-hidden className="relative size-4 shrink-0" />
              )}
              <span className="relative min-w-0 flex-1 text-[14px]">{option.label}</span>
              <span className="u-tnum relative shrink-0 text-[13px] text-ink-soft">{percent} %</span>
            </>
          );

          if (!canVote) {
            return (
              <li key={`${poll.id}-${index}`}>
                <div className={rowClass}>{inner}</div>
              </li>
            );
          }

          return (
            <li key={`${poll.id}-${index}`}>
              <button type="button" aria-pressed={chosen} onClick={() => onVote(index)} className={rowClass}>
                {inner}
                <span className="sr-only">{chosen ? "твой голос" : `голосовать за ${option.label}`}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-2.5 text-[12px] text-ink-soft">
        <span className="u-tnum">{total}</span> {pluralRu(total, ["голос", "голоса", "голосов"])}
        {canVote ? null : ", голос есть у каждого участника"}
      </p>
    </div>
  );
}
