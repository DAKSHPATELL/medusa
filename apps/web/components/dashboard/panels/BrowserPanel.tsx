"use client";

import { useState } from "react";
import { Compass, Globe, Keyboard, MousePointerClick } from "lucide-react";
import type { AgentEventOf } from "@clearborder/shared";
import type { ReceivedEvent } from "@/lib/dashboard/useAgentStream";
import { timeOf } from "@/lib/dashboard/format";

function actionIcon(action: AgentEventOf<"browser.action">["action"]) {
  if (action === "navigate") return Compass;
  if (action === "type") return Keyboard;
  return MousePointerClick;
}

export function BrowserPanel({
  lastShot,
  lastAction,
  recentActions,
}: {
  lastShot: AgentEventOf<"browser.screenshot"> | null;
  lastAction: AgentEventOf<"browser.action"> | null;
  recentActions: Array<ReceivedEvent & { type: "browser.action" }>;
}) {
  const [imgFailed, setImgFailed] = useState<string | null>(null);
  const src =
    lastShot?.ref.kind === "path"
      ? lastShot.ref.path
      : lastShot?.ref.kind === "base64"
        ? `data:${lastShot.ref.mimeType ?? "image/png"};base64,${lastShot.ref.data}`
        : null;
  const showImage = src !== null && imgFailed !== src;
  const ActionIcon = lastAction ? actionIcon(lastAction.action) : MousePointerClick;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto dash-scroll">
        {/* Browser chrome frame */}
        <div className="p-4 pb-0">
          <div className="overflow-hidden rounded-xl border border-line bg-[#0b0e14]">
            <div className="flex items-center gap-2 border-b border-line bg-white/[0.03] px-3 py-2">
              <span className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
              </span>
              <span className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-line bg-abyss/70 px-2.5 py-1 font-mono text-[10.5px] text-dim">
                <Globe size={10} className="shrink-0 text-faint" />
                <span className="truncate">
                  {lastAction?.url ?? "portal.tradegate — TradeGate · Declaration management"}
                </span>
              </span>
            </div>
            <div className="relative aspect-[16/10] w-full">
              {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={lastShot?.caption ?? "Agent browser view"}
                  onError={() => setImgFailed(src)}
                  className="absolute inset-0 h-full w-full object-cover object-top"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[linear-gradient(rgba(151,183,224,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(151,183,224,0.04)_1px,transparent_1px)] bg-[size:22px_22px]">
                  <Globe size={22} className="text-faint" />
                  <p className="m-0 text-[11.5px] text-faint">
                    Awaiting first frame from the agent&apos;s browser
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action caption bar */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-ev-browser/25 bg-ev-browser/[0.07] px-3 py-2.5">
            <ActionIcon size={14} className="shrink-0 text-ev-browser" />
            <p className="m-0 min-w-0 flex-1 truncate text-[12.5px] text-mist">
              {lastAction?.description ?? "No browser activity yet"}
            </p>
            {lastAction?.coordinates ? (
              <span className="shrink-0 rounded border border-line bg-abyss/60 px-1.5 py-0.5 font-mono text-[10px] text-dim">
                {lastAction.coordinates.x}, {lastAction.coordinates.y}
              </span>
            ) : null}
          </div>
        </div>

        {/* Recent actions */}
        <div className="space-y-1.5 px-4 py-3">
          <p className="m-0 pb-1 font-display text-[9.5px] font-bold uppercase tracking-[0.2em] text-faint">
            Recent actions
          </p>
          {recentActions.length === 0 ? (
            <p className="m-0 text-[11.5px] text-faint">—</p>
          ) : (
            [...recentActions].reverse().map((a) => {
              const Icon = actionIcon(a.action);
              return (
                <div key={a.id} className="flex items-center gap-2 text-[11.5px] text-dim">
                  <Icon size={11} className="shrink-0 text-ev-browser/70" />
                  <span className="min-w-0 flex-1 truncate">{a.description}</span>
                  <span className="shrink-0 font-mono text-[10px] text-faint">{timeOf(a.at)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
