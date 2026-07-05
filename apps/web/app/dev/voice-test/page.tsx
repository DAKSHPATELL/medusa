"use client";

/**
 * Dev-only harness: talk to the Gemini Live voice agent with your mic and
 * exercise its tools (esp. get_case_history) directly, without Twilio or the
 * orchestrator's call-scheduling flow. Not part of the demo — separate route,
 * separate backend endpoints (/api/dev/voice-test/*), touches nothing the
 * Twilio/browser-demo work depends on.
 */

import { useEffect, useRef, useState } from "react";
import { agentHttpBase } from "@/lib/demo/agent-api";

type StartResponse = {
  callId: string;
  token: string;
  model: string;
  tools: unknown[];
  context: {
    caseId: string;
    shipperName: string;
    shipperLang: string;
    shipperLanguageCode: string;
    trackingNumber: string;
    declaredValue: number;
    invoiceValue: number;
    invoiceNumber: string;
    currency: string;
  };
};

type TranscriptLine = { who: "you" | "agent"; text: string };

type SenderCallLine = {
  speaker: "agent" | "shipper";
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText: string;
};

type SenderCallResponse = {
  caseId: string;
  shipperName: string;
  shipperLanguageCode: string;
  lines: SenderCallLine[];
};

function decodeBase64Pcm(
  base64: string,
  ctx: AudioContext,
  sampleRate = 24000,
): { buffer: AudioBuffer | null; error?: string; sampleCount?: number; peak?: number } {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const samples = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    const channel = buffer.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = samples[i]! / 32768;
      channel[i] = v;
      const abs = Math.abs(v);
      if (abs > peak) peak = abs;
    }
    return { buffer, sampleCount: samples.length, peak };
  } catch (err) {
    return { buffer: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export default function VoiceTestPage() {
  const [caseId, setCaseId] = useState("CB-2481");
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error" | "ended">("idle");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [senderCall, setSenderCall] = useState<SenderCallResponse | null>(null);
  const [senderCallError, setSenderCallError] = useState<string | null>(null);

  const sessionRef = useRef<{
    close: () => void;
    sendToolResponse: (p: { functionResponses: Array<{ id: string; name: string; response: Record<string, unknown> }> }) => void;
  } | null>(null);
  const callIdRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playHeadRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const audioChunkCountRef = useRef(0);
  const stopMicRef = useRef<(() => void) | null>(null);

  function pushLog(text: string) {
    setLog((prev) => [...prev.slice(-40), `${new Date().toLocaleTimeString()} — ${text}`]);
  }

  async function loadSenderCall(id: string) {
    setSenderCallError(null);
    try {
      const res = await fetch(
        `${agentHttpBase()}/api/dev/voice-test/sender-call?caseId=${encodeURIComponent(id)}`,
      );
      if (!res.ok) throw new Error(await res.text());
      setSenderCall((await res.json()) as SenderCallResponse);
    } catch (err) {
      setSenderCall(null);
      setSenderCallError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void loadSenderCall(caseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function playTestTone() {
    // Isolates whether Web Audio can produce audible sound on this device/
    // browser/tab at all, independent of Gemini — if this is silent too,
    // it's an output routing / mute / volume problem, not the voice pipeline.
    const ctx = new AudioContext();
    await ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 440;
    gain.gain.value = 0.2;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => void ctx.close();
    pushLog(`test tone: new AudioContext state=${ctx.state} — you should hear a 440Hz beep now`);
  }

  async function start() {
    setStatus("connecting");
    setLines([]);
    setLog([]);

    // Safari requires AudioContext creation/unlock to happen synchronously
    // within the click — doing it after network round-trips (like the Live
    // connect handshake below) is enough async delay for Safari to detach it
    // from the user gesture. It then reports state "running" and behaves
    // normally in every way except actually driving the speakers. Chrome is
    // lenient about this; Safari is not. Create + unlock right now instead.
    if (audioCtxRef.current) {
      try {
        await audioCtxRef.current.close();
      } catch {
        /* already closed */
      }
    }
    const playCtx = new AudioContext({ sampleRate: 24000 });
    audioCtxRef.current = playCtx;
    playHeadRef.current = playCtx.currentTime;
    audioChunkCountRef.current = 0;
    try {
      await playCtx.resume();
      // Safari-specific unlock: actually starting a real (silent) buffer
      // source synchronously-ish after the gesture is what reliably wakes
      // the audio hardware in Safari — resume() alone can be insufficient.
      const silence = playCtx.createBuffer(1, 1, playCtx.sampleRate);
      const silenceSrc = playCtx.createBufferSource();
      silenceSrc.buffer = silence;
      silenceSrc.connect(playCtx.destination);
      silenceSrc.start(0);
      pushLog(`playback AudioContext unlocked · state=${playCtx.state}`);
    } catch (err) {
      pushLog(`playback AudioContext unlock FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }

    await loadSenderCall(caseId);
    try {
      const startRes = await fetch(`${agentHttpBase()}/api/dev/voice-test/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      if (!startRes.ok) throw new Error(await startRes.text());
      const payload = (await startRes.json()) as StartResponse;
      callIdRef.current = payload.callId;
      pushLog(`session started · case ${payload.context.caseId} · ${payload.context.shipperName}`);

      const { GoogleGenAI, Modality } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: payload.token, httpOptions: { apiVersion: "v1alpha" } });

      const session = await ai.live.connect({
        model: payload.model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: payload.tools as never,
        },
        callbacks: {
          onopen: () => {
            setStatus("live");
            pushLog("Gemini Live open — speak after the agent's greeting");
          },
          onmessage: async (msg: {
            serverContent?: {
              inputTranscription?: { text?: string };
              outputTranscription?: { text?: string };
              modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
              turnComplete?: boolean;
              interrupted?: boolean;
            };
            toolCall?: { functionCalls?: Array<{ id?: string; name?: string; args?: Record<string, unknown> }> };
          }) => {
            const sc = msg.serverContent;
            if (sc?.inputTranscription?.text) {
              setLines((prev) => [...prev, { who: "you", text: sc.inputTranscription!.text! }]);
            }
            if (sc?.outputTranscription?.text) {
              setLines((prev) => [...prev, { who: "agent", text: sc.outputTranscription!.text! }]);
            }

            // NOTE: deliberately NOT stopping active audio sources on
            // `interrupted` anymore. Without headphones, residual mic
            // feedback makes the server report `interrupted` far too often
            // (not just on genuine barge-in), and forcibly stopping playback
            // each time meant the agent's speech kept getting killed a
            // fraction of a second after starting — the "it doesn't speak"
            // bug. Letting it play through is the right trade-off: you get
            // audible speech, at the cost of occasional overlap on a real
            // interruption.
            if (sc?.interrupted && audioCtxRef.current) {
              pushLog("(interrupted signal received — ignoring, audio keeps playing)");
            }

            const parts = sc?.modelTurn?.parts ?? [];
            let audioPartsThisMsg = 0;
            for (const part of parts) {
              const data = part.inlineData?.data;
              const mime = part.inlineData?.mimeType ?? "";
              if (!data) continue;
              if (!mime.includes("audio")) {
                pushLog(`non-audio inlineData part, mimeType="${mime}"`);
                continue;
              }
              audioPartsThisMsg++;
              if (!audioCtxRef.current) {
                pushLog("audio part received but no playback AudioContext yet — dropped");
                continue;
              }
              const ctx = audioCtxRef.current;
              const { buffer: buf, error, sampleCount, peak } = decodeBase64Pcm(data, ctx);
              if (!buf) {
                pushLog(`audio decode FAILED: ${error}`);
                continue;
              }
              const src = ctx.createBufferSource();
              src.buffer = buf;
              src.connect(ctx.destination);
              activeSourcesRef.current.push(src);
              src.onended = () => {
                activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== src);
              };
              // Schedule back-to-back instead of all starting "now" — this
              // is what was causing overlapping/garbled audio.
              const now = ctx.currentTime;
              if (playHeadRef.current < now) playHeadRef.current = now;
              src.start(playHeadRef.current);
              audioChunkCountRef.current++;
              // Throttled — logging (a React re-render) on every ~40ms chunk
              // was itself enough overhead to risk falling behind real-time
              // scheduling. Log every 25th chunk instead, plus a lead/lag
              // figure so we can see if playback is keeping up with "now".
              if (audioChunkCountRef.current % 25 === 1) {
                pushLog(
                  `audio chunk #${audioChunkCountRef.current}: ${sampleCount} samples · peak=${peak?.toFixed(4)} · ctx.state=${ctx.state} · lead=${(playHeadRef.current - now).toFixed(2)}s`,
                );
              }
              playHeadRef.current += buf.duration;
            }

            const calls = msg.toolCall?.functionCalls ?? [];
            if (calls.length > 0 && callIdRef.current) {
              pushLog(`tool call: ${calls.map((c) => c.name).join(", ")}`);
              const functionResponses = await Promise.all(
                calls.map(async (call) => {
                  const res = await fetch(
                    `${agentHttpBase()}/api/dev/voice-test/${callIdRef.current}/tool-call`,
                    {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ name: call.name, args: call.args ?? {} }),
                    },
                  );
                  const response = res.ok ? await res.json() : { error: await res.text() };
                  return { id: call.id ?? call.name ?? "", name: call.name ?? "", response };
                }),
              );
              sessionRef.current?.sendToolResponse({ functionResponses });
            }
          },
          onerror: (e: unknown) => {
            setStatus("error");
            pushLog(`error: ${String(e)}`);
          },
          onclose: () => {
            sessionRef.current = null;
          },
        },
      });

      sessionRef.current = session;
      // playCtx was already created + unlocked synchronously at the top of
      // start(), before any of the network round-trips above — deliberately
      // not recreating it here (that was the bug: recreating this late is
      // exactly the point where Safari silently detaches it from the click).

      // Nudge the agent to open the call — the BROKER just joined, the
      // shipper call already happened separately (see the transcript above).
      const c = payload.context;
      session.sendClientContent({
        turns: [
          {
            role: "user",
            parts: [
              {
                text: `The broker is now on the line about case ${c.caseId} (tracking ${c.trackingNumber}, shipper ${c.shipperName}). Greet them, briefly summarize the valuation hold and what you resolved on the earlier shipper call, then invite their questions.`,
              },
            ],
          },
        ],
        turnComplete: true,
      });

      // echoCancellation matters a lot here: without it (and without
      // headphones) the mic picks up the agent's own voice from the
      // speakers, which is what produced garbled/hallucinated transcripts.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      const recCtx = new AudioContext({ sampleRate: 16000 });
      const source = recCtx.createMediaStreamSource(stream);
      const processor = recCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (ev) => {
        // NOTE: no gating here — blocking mic input for the agent's entire
        // speaking turn was tried and made things worse (it silently drops
        // anything you say before the agent finishes, so the conversation
        // just stalls). Real fix for self-echo is headphones; without them,
        // echoCancellation above is the best we can do client-side.
        const input = ev.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, input[i]! * 32768));
        const bytes = new Uint8Array(pcm.buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
        session.sendRealtimeInput({ audio: { data: btoa(binary), mimeType: "audio/pcm;rate=16000" } });
      };
      source.connect(processor);
      processor.connect(recCtx.destination);
      stopMicRef.current = () => {
        try {
          processor.disconnect();
          source.disconnect();
          stream.getTracks().forEach((t) => t.stop());
          recCtx.close();
        } catch {
          /* ignore */
        }
      };
    } catch (err) {
      console.error("[voice-test]", err);
      setStatus("error");
      pushLog(`failed to start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function end() {
    try {
      sessionRef.current?.close();
    } catch {
      /* ignore */
    }
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        /* already ended */
      }
    }
    activeSourcesRef.current = [];
    if (audioCtxRef.current) {
      try {
        await audioCtxRef.current.close();
      } catch {
        /* already closed */
      }
      audioCtxRef.current = null;
    }
    stopMicRef.current?.();
    if (callIdRef.current) {
      await fetch(`${agentHttpBase()}/api/dev/voice-test/${callIdRef.current}/end`, { method: "POST" });
    }
    setStatus("ended");
  }

  const isLive = status === "live" || status === "connecting";

  return (
    <main className="demo-bg min-h-screen text-mist">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
          ClearBorder · voice agent
        </p>
        <h1 className="mt-1.5 font-display text-xl font-semibold text-mist">
          Review the case, then go live as the broker
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dim">
          Below is the sender call that already happened (text only, bilingual — you weren&apos;t on
          that call). Then go live yourself as the broker and ask real questions in English, e.g.{" "}
          <span className="text-mist">&quot;why did you change the currency?&quot;</span> — the agent
          looks up the actual case history instead of guessing.
        </p>

        <div className="glass mt-6 flex items-center gap-3 px-4 py-3">
          <input
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            onBlur={() => void loadSenderCall(caseId)}
            disabled={isLive}
            className="min-w-0 flex-1 rounded-md border border-line bg-white/[0.03] px-3 py-1.5 font-mono text-[13px] text-mist outline-none placeholder:text-faint focus:border-ev-call/50"
            placeholder="Case ID, e.g. CB-2481"
          />
          <button
            onClick={() => void playTestTone()}
            className="shrink-0 rounded-md border border-line bg-white/[0.03] px-3 py-1.5 text-[13px] font-semibold text-dim transition hover:text-mist"
            title="Play a 440Hz beep to check your audio output works at all"
          >
            🔊 Test tone
          </button>
          {isLive ? (
            <button
              onClick={end}
              className="shrink-0 rounded-md border border-ev-danger/40 bg-ev-danger/10 px-4 py-1.5 text-[13px] font-semibold text-ev-danger transition hover:bg-ev-danger/20"
            >
              End call
            </button>
          ) : (
            <button
              onClick={start}
              className="shrink-0 rounded-md border border-ev-call/40 bg-ev-call/10 px-4 py-1.5 text-[13px] font-semibold text-ev-call transition hover:bg-ev-call/20"
            >
              Go live as broker
            </button>
          )}
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-faint">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status === "live" ? "bg-ev-call animate-pulse-dot" : status === "error" ? "bg-ev-danger" : "bg-faint"
              }`}
            />
            {status}
          </span>
        </div>

        <div className="mt-6">
          <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-dim">
            Sender call · already happened · read only
          </h2>
          <div className="glass-deep demo-scroll mt-2 max-h-64 overflow-y-auto px-4 py-3 text-[13px] leading-relaxed">
            {senderCallError ? (
              <p className="text-ev-danger">{senderCallError}</p>
            ) : !senderCall ? (
              <p className="text-faint">Loading…</p>
            ) : (
              senderCall.lines.map((l, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-faint">
                    {l.speaker === "agent" ? "agent → sender  " : `${senderCall.shipperName}  `}
                  </span>
                  <p className={l.speaker === "agent" ? "text-accent" : "text-ev-call"}>{l.sourceText}</p>
                  <p className="text-faint">→ {l.translatedText}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-dim">
            You (broker) ↔ agent · live
          </h2>
          <div className="glass-deep demo-scroll mt-2 h-64 overflow-y-auto px-4 py-3 text-[13.5px] leading-relaxed">
            {lines.length === 0 ? (
              <p className="text-faint">Nothing yet — go live and speak.</p>
            ) : (
              lines.map((l, i) => (
                <p key={i} className={l.who === "you" ? "text-ev-call" : "text-accent"}>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-faint">
                    {l.who === "you" ? "you  " : "agent  "}
                  </span>
                  <span className="text-mist">{l.text}</span>
                </p>
              ))
            )}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-dim">
            Log
          </h2>
          <div className="glass-deep demo-scroll mt-2 h-40 overflow-y-auto px-4 py-3 font-mono text-[11.5px] leading-relaxed text-dim">
            {log.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
