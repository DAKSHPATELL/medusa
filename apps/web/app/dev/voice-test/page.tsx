"use client";

/**
 * Dev-only harness: talk to the Gemini Live voice agent with your mic and
 * exercise its tools (esp. get_case_history) directly, without Twilio or the
 * orchestrator's call-scheduling flow. Not part of the demo — separate route,
 * separate backend endpoints (/api/dev/voice-test/*), touches nothing the
 * Twilio/browser-demo work depends on.
 */

import { useRef, useState } from "react";
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

function decodeBase64Pcm(base64: string, sampleRate = 24000): AudioBuffer | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const samples = new Int16Array(bytes.buffer);
    const ctx = new AudioContext({ sampleRate });
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i]! / 32768;
    return buffer;
  } catch {
    return null;
  }
}

export default function VoiceTestPage() {
  const [caseId, setCaseId] = useState("CB-2481");
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error" | "ended">("idle");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const sessionRef = useRef<{
    close: () => void;
    sendToolResponse: (p: { functionResponses: Array<{ id: string; name: string; response: Record<string, unknown> }> }) => void;
  } | null>(null);
  const callIdRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopMicRef = useRef<(() => void) | null>(null);

  function pushLog(text: string) {
    setLog((prev) => [...prev.slice(-40), `${new Date().toLocaleTimeString()} — ${text}`]);
  }

  async function start() {
    setStatus("connecting");
    setLines([]);
    setLog([]);
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
            const parts = sc?.modelTurn?.parts ?? [];
            for (const part of parts) {
              const data = part.inlineData?.data;
              const mime = part.inlineData?.mimeType ?? "";
              if (data && mime.includes("audio") && audioCtxRef.current) {
                const buf = decodeBase64Pcm(data);
                if (buf) {
                  const src = audioCtxRef.current.createBufferSource();
                  src.buffer = buf;
                  src.connect(audioCtxRef.current.destination);
                  src.start();
                }
              }
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
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 });

      // Nudge the agent to open the call, same pattern as the Twilio bridge.
      const c = payload.context;
      session.sendClientContent({
        turns: [
          {
            role: "user",
            parts: [
              {
                text: `Begin the outbound customs call to ${c.shipperName}. Explain the valuation hold on tracking ${c.trackingNumber} — declared ${c.currency} ${c.declaredValue.toFixed(2)} vs invoice ${c.invoiceNumber} ${c.currency} ${c.invoiceValue.toFixed(2)}.`,
              },
            ],
          },
        ],
        turnComplete: true,
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recCtx = new AudioContext({ sampleRate: 16000 });
      const source = recCtx.createMediaStreamSource(stream);
      const processor = recCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (ev) => {
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
    stopMicRef.current?.();
    if (callIdRef.current) {
      await fetch(`${agentHttpBase()}/api/dev/voice-test/${callIdRef.current}/end`, { method: "POST" });
    }
    setStatus("ended");
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-neutral-950 p-8 text-neutral-100">
      <h1 className="text-lg font-semibold">Dev voice-test harness</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Not part of the demo. Talk to the live voice agent and ask it things like
        &quot;why did you change the currency?&quot; to exercise <code>get_case_history</code>.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <input
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          disabled={status === "connecting" || status === "live"}
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
          placeholder="Case ID, e.g. CB-2481"
        />
        {status === "live" || status === "connecting" ? (
          <button
            onClick={end}
            className="rounded bg-red-600 px-4 py-1.5 text-sm font-medium hover:bg-red-500"
          >
            End call
          </button>
        ) : (
          <button
            onClick={start}
            className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium hover:bg-emerald-500"
          >
            Start test call
          </button>
        )}
        <span className="text-xs uppercase tracking-wide text-neutral-500">{status}</span>
      </div>

      <div className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Transcript</h2>
        <div className="mt-2 h-64 overflow-y-auto rounded border border-neutral-800 bg-neutral-900 p-3 text-sm">
          {lines.length === 0 ? (
            <p className="text-neutral-600">Nothing yet.</p>
          ) : (
            lines.map((l, i) => (
              <p key={i} className={l.who === "you" ? "text-blue-400" : "text-amber-400"}>
                <span className="text-neutral-500">{l.who === "you" ? "you: " : "agent: "}</span>
                {l.text}
              </p>
            ))
          )}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Log</h2>
        <div className="mt-2 h-40 overflow-y-auto rounded border border-neutral-800 bg-neutral-900 p-3 font-mono text-xs text-neutral-400">
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </main>
  );
}
