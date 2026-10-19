import type { ReactNode, SVGProps } from "react";
import type { IconName } from "@/lib/types";

/**
 * Hand-drawn icon set. One consistent 24px grid, 1.6px stroke, currentColor
 * only — no icon library, so the line weight matches the hairline borders
 * used everywhere else. Keys must stay in sync with `IconName`.
 */
const paths: Record<IconName, ReactNode> = {
  feed: <path d="M4 6h3.5M11 6h9M4 12h3.5M11 12h9M4 18h3.5M11 18h6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.2" />
      <path d="M15.6 15.6 20 20" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chat: <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5L4 20z" />,
  person: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" />
    </>
  ),
  bell: (
    <>
      <path d="M7 10.5a5 5 0 0 1 10 0c0 3.9 1.5 4.9 1.5 4.9h-13S7 14.4 7 10.5z" />
      <path d="M10.4 18.2a1.9 1.9 0 0 0 3.2 0" />
    </>
  ),
  check: <path d="M5 12.6 9.5 17 19 7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="M11 5l-7 7 7 7M4.5 12H20" />,
  pin: (
    <>
      <path d="M8.5 4h7M10 4l-.8 6.6L7 13.4h10l-2.2-2.8L14 4" />
      <path d="M12 13.4V21" />
    </>
  ),
  poll: <path d="M6 20V11M12 20V4.5M18 20v-6.5" />,
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.2" />
      <circle cx="8.8" cy="10" r="1.6" />
      <path d="m4.5 17.2 4.8-3.9 3.9 2.9 2.9-2 4.4 3.2" />
    </>
  ),
  send: (
    <>
      <path d="M4 11.6 20 4l-6.6 16-2.6-6.6z" />
      <path d="m10.8 13.4 9.2-9.4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 3.2v2.5M12 18.3v2.5M4.6 7.6l2.2 1.3M17.2 15.1l2.2 1.3M4.6 16.4l2.2-1.3M17.2 8.9l2.2-1.3" />
    </>
  ),
  shield: <path d="M12 3.4 19 6v6c0 4.1-3 7.1-7 8.6-4-1.5-7-4.5-7-8.6V6z" />,
  lock: (
    <>
      <rect x="5" y="10.8" width="14" height="9.2" rx="2.2" />
      <path d="M8.6 10.8V8a3.4 3.4 0 0 1 6.8 0v2.8" />
    </>
  ),
  seat: (
    <>
      <path d="M7.5 11V6.2A2.2 2.2 0 0 1 9.7 4h4.6a2.2 2.2 0 0 1 2.2 2.2V11" />
      <rect x="5" y="11" width="14" height="6" rx="1.6" />
      <path d="M7.5 17v3M16.5 17v3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.4V12l3.4 2" />
    </>
  ),
  place: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2.2" />
      <path d="M4 11h16M9 4v4M15 4v4" />
    </>
  ),
  glass: (
    <>
      <path d="M8 4h8l-1 14.8A2.2 2.2 0 0 1 12.8 21h-1.6A2.2 2.2 0 0 1 9 18.8z" />
      <path d="M8.3 10h7.4" />
    </>
  ),
  book: (
    <>
      <path d="M5 5.6A2.6 2.6 0 0 1 7.6 3H19v15H7.6A2.6 2.6 0 0 0 5 20.6z" />
      <path d="M19 18v3H7.6" />
    </>
  ),
  ball: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m12 7.8 3.2 2.3-1.2 3.7h-4l-1.2-3.7z" />
    </>
  ),
  plate: (
    <>
      <circle cx="12" cy="12" r="7.6" />
      <circle cx="12" cy="12" r="3.4" />
    </>
  ),
  ticket: (
    <>
      <rect x="3.5" y="7" width="17" height="10" rx="2.2" />
      <path d="M9.5 7.6v1.8M9.5 11.1v1.8M9.5 14.6v1.8" />
    </>
  ),
  note: (
    <>
      <circle cx="8" cy="17.2" r="2.6" />
      <circle cx="17" cy="15.2" r="2.6" />
      <path d="M10.6 17.2V7.2l9-2v10" />
    </>
  ),
  cards: (
    <>
      <rect x="9" y="4" width="9.5" height="13.5" rx="1.8" />
      <path d="M6.6 7.4H6a1.5 1.5 0 0 0-1.5 1.5v9.6A1.5 1.5 0 0 0 6 20h7.4" />
    </>
  ),
  bike: (
    <>
      <circle cx="6" cy="17" r="3.4" />
      <circle cx="18" cy="17" r="3.4" />
      <path d="m6 17 5-8h4M11 9l4.4 8M13.6 6H16.6" />
    </>
  ),
  camera: (
    <>
      <path d="M4 9.8a2.2 2.2 0 0 1 2.2-2.2h1.5L9 5.4h6l1.3 2.2h1.5A2.2 2.2 0 0 1 20 9.8v7a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 16.8z" />
      <circle cx="12" cy="13" r="3.1" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4.2 12h15.6" />
      <path d="M12 4c3 3.6 3 12.4 0 16M12 4c-3 3.6-3 12.4 0 16" />
    </>
  ),
  heart: <path d="M12 20.2S5 15.9 5 11a4 4 0 0 1 7-2.8A4 4 0 0 1 19 11c0 4.9-7 9.2-7 9.2z" />,
  briefcase: (
    <>
      <rect x="3.5" y="8" width="17" height="11" rx="2.2" />
      <path d="M9.2 8V6.2A2.2 2.2 0 0 1 11.4 4h1.2a2.2 2.2 0 0 1 2.2 2.2V8M3.5 13h17" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </>
  ),
  sparkle: <path d="m12 4 1.9 5.3L19 11l-5.1 1.7L12 18l-1.9-5.3L5 11l5.1-1.7z" />,
  chevron: <path d="m9.5 6 6 6-6 6" />,
  reply: <path d="M10 6 4.5 11.5 10 17M5 11.5h8.5a6 6 0 0 1 6 6V19" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.8h5V7" />
      <path d="M6.6 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6a1.5 1.5 0 0 0 1.5-1.3L17.4 7" />
      <path d="M10.2 11v5.6M13.8 11v5.6" />
    </>
  ),
  flag: <path d="M6 21V4.5M6 5h10.8l-2.3 4 2.3 4H6" />,
  block: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m6.4 6.4 11.2 11.2" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </>
  ),
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />,
  warning: (
    <>
      <path d="M12 4 21 19.5H3z" />
      <path d="M12 10v4.4M12 17.2v.1" />
    </>
  ),
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  /** Supplying a title makes the icon readable to assistive tech. */
  title?: string;
}

export function Icon({ name, size = 20, title, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  );
}
