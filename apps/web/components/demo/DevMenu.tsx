"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Play, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { agentPost } from "@/lib/demo/agent-api";

/** Hidden demo controls — toggle with "D" or the corner dot. */
export function DevMenu({ currentDay, connected }: { currentDay: number; connected: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (e.key.toLowerCase() === "d" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = async (label: string, path: string, body?: unknown) => {
    if (busy) return;
    setBusy(label);
    try {
      await agentPost(path, body);
    } finally {
      setTimeout(() => setBusy(null), 600);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Demo controls (D)"
        data-testid="dev-menu-toggle"
        className="fixed bottom-4 right-4 z-40 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-line bg-abyss/80 text-faint backdrop-blur transition-colors hover:border-accent/40 hover:text-accent"
      >
        <SlidersHorizontal size={13} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="fixed bottom-14 right-4 z-40 w-[264px] rounded-2xl border border-line bg-[#0b0e14]/95 p-4 shadow-2xl backdrop-blur-xl"
            data-testid="dev-menu"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-[10px] font-bold uppercase tracking-[0.24em] text-dim">
                Demo controls
              </span>
              <button
                onClick={() => setOpen(false)}
                className="cursor-pointer text-faint hover:text-mist"
                aria-label="Close demo controls"
              >
                <X size={13} />
              </button>
            </div>

            <p className="mb-1.5 mt-0 text-[10px] font-medium uppercase tracking-wider text-faint">
              Play demo day
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((day) => (
                <button
                  key={day}
                  data-testid={`dev-day-${day}`}
                  disabled={busy !== null}
                  onClick={() => run(`day${day}`, "/api/demo/replay", { day })}
                  className={`cursor-pointer rounded-lg border px-2 py-2 text-center transition-colors disabled:opacity-50 ${
                    currentDay === day
                      ? "border-accent/45 bg-accent/12 text-accent"
                      : "border-line bg-white/[0.03] text-dim hover:border-accent/30 hover:text-mist"
                  }`}
                >
                  <span className="block font-display text-[15px] font-bold leading-none">
                    {busy === `day${day}` ? (
                      <Play size={13} className="mx-auto animate-pulse" />
                    ) : (
                      day
                    )}
                  </span>
                  <span className="mt-1 block text-[8.5px] uppercase tracking-wider opacity-70">
                    Jul {day + 1}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              <button
                data-testid="dev-reset"
                disabled={busy !== null}
                onClick={() => run("reset", "/api/demo/reset")}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-3 py-2 text-[12px] text-dim transition-colors hover:border-ev-danger/35 hover:text-ev-danger disabled:opacity-50"
              >
                <RotateCcw size={12} />
                Reset demo state
              </button>
              <a
                href="/portal/login"
                target="_blank"
                className="flex w-full items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-3 py-2 text-[12px] text-dim transition-colors hover:border-accent/35 hover:text-mist"
              >
                <ExternalLink size={12} />
                Open TradeGate portal
              </a>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="text-[10px] uppercase tracking-wider text-faint">Agent link</span>
              <span
                className={`flex items-center gap-1.5 text-[10.5px] font-medium ${connected ? "text-ev-call" : "text-ev-danger"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-ev-call" : "bg-ev-danger animate-pulse-dot"}`}
                />
                {connected ? "Connected" : "Reconnecting"}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
