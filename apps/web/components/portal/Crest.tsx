export function Crest({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* shield */}
      <path
        d="M24 3 L42 9 V22 C42 33.5 34.5 41.5 24 45 C13.5 41.5 6 33.5 6 22 V9 Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M24 3 L42 9 V22 C42 33.5 34.5 41.5 24 45 C13.5 41.5 6 33.5 6 22 V9 Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* three stars */}
      <path d="M15.5 12.2 l1.05 2.13 2.35.34 -1.7 1.66 .4 2.34 -2.1-1.1 -2.1 1.1 .4-2.34 -1.7-1.66 2.35-.34 Z" fill="currentColor" />
      <path d="M24 10.2 l1.05 2.13 2.35.34 -1.7 1.66 .4 2.34 -2.1-1.1 -2.1 1.1 .4-2.34 -1.7-1.66 2.35-.34 Z" fill="currentColor" />
      <path d="M32.5 12.2 l1.05 2.13 2.35.34 -1.7 1.66 .4 2.34 -2.1-1.1 -2.1 1.1 .4-2.34 -1.7-1.66 2.35-.34 Z" fill="currentColor" />
      {/* border gate chevrons */}
      <path d="M12 27 L24 21.5 L36 27" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M12 33 L24 27.5 L36 33" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M15 38.4 L24 34 L33 38.4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
