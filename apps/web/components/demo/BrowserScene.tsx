"use client";

import { useState } from "react";
import { Globe, MousePointerClick } from "lucide-react";
import type { AgentEventOf } from "@clearborder/shared";

export function BrowserScene({
  shot,
  action,
}: {
  shot: AgentEventOf<"browser.screenshot">;
  action: AgentEventOf<"browser.action"> | null;
}) {
  const [imgFailed, setImgFailed] = useState<string | null>(null);
  const src =
    shot.ref.kind === "path"
      ? shot.ref.path
      : shot.ref.kind === "base64"
        ? `data:${shot.ref.mimeType ?? "image/png"};base64,${shot.ref.data}`
        : null;
  const showImage = src !== null && imgFailed !== src;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-ev-browser/25 bg-gradient-to-b from-ev-browser/[0.06] to-transparent"
      data-testid="browser-scene"
    >
      <div className="border-b border-ev-browser/15 px-5 py-3.5">
        <p className="m-0 font-display text-[10px] font-bold uppercase tracking-[0.22em] text-ev-browser">
          Portal automation
        </p>
        {action ? (
          <p className="mt-1.5 m-0 flex items-center gap-2 text-[14px] text-mist">
            <MousePointerClick size={14} className="shrink-0 text-ev-browser" />
            {action.description}
          </p>
        ) : null}
      </div>

      <div className="p-4">
        <div className="overflow-hidden rounded-xl border border-line bg-[#0b0e14]">
          <div className="flex items-center gap-2 border-b border-line bg-white/[0.03] px-3 py-2">
            <span className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
            </span>
            <span className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-line bg-abyss/70 px-2.5 py-1 font-mono text-[10.5px] text-dim">
              <Globe size={10} className="shrink-0 text-faint" />
              <span className="truncate">portal.tradegate — TradeGate</span>
            </span>
          </div>
          <div className="relative aspect-[16/10] w-full">
            {showImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={shot.caption ?? "Agent browser view"}
                onError={() => setImgFailed(src)}
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(rgba(151,183,224,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(151,183,224,0.04)_1px,transparent_1px)] bg-[size:22px_22px]">
                <Globe size={22} className="text-faint" />
              </div>
            )}
          </div>
        </div>
        {shot.caption ? (
          <p className="mt-3 mb-0 text-[13px] leading-relaxed text-dim">{shot.caption}</p>
        ) : null}
      </div>
    </section>
  );
}
