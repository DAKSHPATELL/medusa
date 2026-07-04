export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="8.5"
        stroke="rgba(151,183,224,0.25)"
        fill="rgba(62,224,255,0.06)"
      />
      {/* vertical border line, breached */}
      <path d="M16 4.5 V11" stroke="rgba(151,183,224,0.5)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 21 V27.5" stroke="rgba(151,183,224,0.5)" strokeWidth="1.6" strokeLinecap="round" />
      {/* double chevron passing through */}
      <path
        d="M9 11 L14.5 16 L9 21"
        stroke="#3ee0ff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 11 L22 16 L16.5 21"
        stroke="#3ee0ff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 select-none">
      <LogoMark />
      <span className="font-display text-[17px] font-semibold tracking-tight text-mist">
        ClearBorder
        <span className="ml-2 rounded-[4px] border border-line bg-white/[0.04] px-1.5 py-0.5 align-middle text-[9.5px] font-mono font-medium uppercase tracking-[0.18em] text-dim">
          Mission Control
        </span>
      </span>
    </span>
  );
}
