"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Radio } from "lucide-react";
import type { CallView } from "@/lib/demo/useAgentStream";
import { agentHttpBase, agentPost } from "@/lib/demo/agent-api";

interface LiveVoiceBridgeProps {
  call: CallView;
  voiceMode: "browser" | "twilio" | "mock" | null;
}

type LiveTokenResponse = {
  token: string;
  model: string;
  callId: string;
  context: {
    caseId: string;
    shipperName: string;
    shipperLanguageCode: string;
    trackingNumber: string;
    declaredValue: number;
    invoiceValue: number;
    invoiceNumber: string;
    currency: string;
  };
};

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

export function LiveVoiceBridge({ call, voiceMode }: LiveVoiceBridgeProps) {
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "done" | "error">("idle");
  const [micOn, setMicOn] = useState(false);
  const handledRef = useRef<Set<string>>(new Set());
  const sessionRef = useRef<{ close: () => void } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (voiceMode !== "browser") return;
    if (!call.started || call.ended) return;
    const callId = call.started.callId;
    if (handledRef.current.has(callId)) return;
    handledRef.current.add(callId);

    let cancelled = false;
    let completed = false;
    const lines: Array<{
      speaker: "agent" | "shipper";
      sourceLang: string;
      targetLang: string;
      sourceText: string;
      translatedText: string;
    }> = [];

    async function finishCall(ctx: LiveTokenResponse["context"]) {
      if (cancelled || completed) return;
      completed = true;
      cancelled = true;
      setStatus("done");
      try {
        sessionRef.current?.close();
      } catch {
        /* ignore */
      }
      const summary = `Shipper confirmed invoice value ${ctx.currency} ${ctx.invoiceValue.toFixed(2)} via Gemini Live browser session.`;
      await agentPost(`/api/voice/${callId}/complete`, {
        summary,
        confirmedValue: ctx.invoiceValue,
        transcripts: lines,
      });
    }

    async function runLiveSession() {
      setStatus("connecting");
      try {
        const tokenRes = await fetch(`${agentHttpBase()}/api/voice/live-token`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ callId }),
        });
        if (!tokenRes.ok) throw new Error(await tokenRes.text());
        const tokenPayload = (await tokenRes.json()) as LiveTokenResponse;

        const { GoogleGenAI, Modality } = await import("@google/genai");
        const ai = new GoogleGenAI({
          apiKey: tokenPayload.token,
          httpOptions: { apiVersion: "v1alpha" },
        });

        const ctx = tokenPayload.context;
        let agentLine = "";
        let shipperLine = "";
        let turnCount = 0;

        const session = await ai.live.connect({
          model: tokenPayload.model,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              if (!cancelled) setStatus("live");
            },
            onmessage: (msg: { serverContent?: {
              inputTranscription?: { text?: string };
              outputTranscription?: { text?: string };
              modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
              turnComplete?: boolean;
            } }) => {
              if (cancelled) return;
              const sc = msg.serverContent;
              if (sc?.inputTranscription?.text) {
                agentLine += sc.inputTranscription.text;
              }
              if (sc?.outputTranscription?.text) {
                shipperLine += sc.outputTranscription.text;
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

              if (sc?.turnComplete) {
                turnCount += 1;
                if (agentLine.trim()) {
                  const line = {
                    speaker: "agent" as const,
                    sourceLang: "en",
                    targetLang: ctx.shipperLanguageCode ?? "zh-CN",
                    sourceText: agentLine.trim(),
                    translatedText: agentLine.trim(),
                  };
                  lines.push(line);
                  void agentPost(`/api/voice/${callId}/transcript`, { ...line, partial: false });
                  agentLine = "";
                }
                if (shipperLine.trim()) {
                  const line = {
                    speaker: "shipper" as const,
                    sourceLang: ctx.shipperLanguageCode ?? "zh-CN",
                    targetLang: "en",
                    sourceText: shipperLine.trim(),
                    translatedText: shipperLine.trim(),
                  };
                  lines.push(line);
                  void agentPost(`/api/voice/${callId}/transcript`, { ...line, partial: false });
                  shipperLine = "";
                }

                if (turnCount >= 2) {
                  void finishCall(ctx);
                }
              }
            },
            onerror: () => {
              if (!cancelled) setStatus("error");
            },
            onclose: () => {
              sessionRef.current = null;
            },
          },
        });

        sessionRef.current = session;

        audioCtxRef.current = new AudioContext({ sampleRate: 24000 });

        session.sendClientContent({
          turns: [
            {
              role: "user",
              parts: [
                {
                  text: `Begin the customs call now. Agent speaks English first: ask ${ctx.shipperName} to confirm invoice ${ctx.invoiceNumber} total ${ctx.currency} ${ctx.invoiceValue}. Then respond as the shipper in Mandarin confirming ${ctx.invoiceValue} and admitting the decimal error on ${ctx.declaredValue}.`,
                },
              ],
            },
          ],
          turnComplete: true,
        });

        // Optional microphone stream
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMicOn(true);
          const recCtx = new AudioContext({ sampleRate: 16000 });
          const source = recCtx.createMediaStreamSource(stream);
          const processor = recCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (ev) => {
            if (cancelled) return;
            const input = ev.inputBuffer.getChannelData(0);
            const pcm = new Int16Array(input.length);
            for (let i = 0; i < input.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, input[i]! * 32768));
            const bytes = new Uint8Array(pcm.buffer);
            let binary = "";
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
            session.sendRealtimeInput({
              audio: { data: btoa(binary), mimeType: "audio/pcm;rate=16000" },
            });
          };
          source.connect(processor);
          processor.connect(recCtx.destination);
        } catch {
          setMicOn(false);
        }

        window.setTimeout(() => {
          void finishCall(ctx);
        }, 45_000);
      } catch (err) {
        console.error("[LiveVoiceBridge]", err);
        setStatus("error");
      }
    }

    void runLiveSession();

    return () => {
      cancelled = true;
      sessionRef.current?.close();
    };
  }, [call.started, call.ended, voiceMode]);

  if (voiceMode !== "browser" || !call.started || call.ended) return null;
  if (status === "idle" || status === "done") return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-ev-call/40 bg-abyss/95 px-4 py-2 text-[11px] font-semibold text-ev-call shadow-lg backdrop-blur"
      data-testid="live-voice-bridge"
    >
      <Radio size={14} className={status === "live" ? "animate-pulse" : ""} />
      {status === "connecting" ? "Connecting Gemini Live…" : "Gemini Live active"}
      {micOn ? <Mic size={13} /> : <MicOff size={13} className="opacity-50" />}
    </div>
  );
}
