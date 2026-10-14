// File: src/components/Logo.jsx
export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect width="64" height="64" rx="16" className="fill-vast-950 dark:fill-sand-50" />
      <rect x="13" y="26" width="6" height="12" rx="3" fill="#f0d7ff" />
      <rect x="23" y="18" width="6" height="28" rx="3" className="fill-sand-50 dark:fill-vast-950" />
      <rect x="33" y="12" width="6" height="40" rx="3" className="fill-sand-50 dark:fill-vast-950" />
      <rect x="43" y="22" width="6" height="20" rx="3" fill="#84cdc1" />
    </svg>
  );
}

export default function Logo({ size = 28 }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="font-display text-[22px] leading-none tracking-tight text-ink">Flow</span>
    </span>
  );
}
