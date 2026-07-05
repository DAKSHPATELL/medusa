"use client";

import { useEffect, useRef } from "react";

/** Lightweight phone-style ring via Web Audio — no external assets. */
export function useRingTone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
      return;
    }

    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const playBurst = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.value = 480;
      gain2.gain.setValueAtTime(0, ctx.currentTime + 0.45);
      gain2.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.47);
      gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.45);
      osc2.stop(ctx.currentTime + 0.85);
    };

    playBurst();
    intervalRef.current = setInterval(playBurst, 2800);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      void ctx.close();
      ctxRef.current = null;
    };
  }, [active]);
}
