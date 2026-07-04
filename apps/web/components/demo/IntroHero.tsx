import { LogoMark } from "./Logo";

export function IntroHero() {
  return (
    <section className="py-16 text-center" data-testid="intro-hero">
      <div className="mx-auto mb-6 opacity-40">
        <LogoMark size={64} />
      </div>
      <h1 className="m-0 font-display text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight tracking-tight text-mist">
        A package stuck at the border.
        <br />
        <span className="text-accent">Watch the agent work.</span>
      </h1>
      <p className="mx-auto mt-5 mb-0 max-w-md text-[15px] leading-relaxed text-dim">
        ClearBorder calls the shipper in Mandarin, operates the customs portal, and remembers
        everything across days — no control room, just the story unfolding.
      </p>
      <p className="mt-8 mb-0 text-[13px] text-faint">
        Press{" "}
        <kbd className="rounded border border-line bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px] text-dim">
          D
        </kbd>{" "}
        and play <span className="text-mist">Day 1</span> to begin
      </p>
    </section>
  );
}
