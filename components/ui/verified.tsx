/**
 * Identity verification. It grants no privileges anywhere in the app — it
 * only tells other students the person behind the profile was checked.
 */
export function Verified({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label="Личность подтверждена"
      className={className}
      style={{ color: "var(--c-verified)" }}
    >
      <title>Личность подтверждена</title>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="m7.6 12.4 2.9 2.9 5.9-6.2"
        fill="none"
        stroke="var(--c-surface)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
