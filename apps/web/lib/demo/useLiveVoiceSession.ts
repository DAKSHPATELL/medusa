"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { agentHttpBase, agentPost } from "@/lib/demo/agent-api";

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

export type LiveVoiceStatus = "idle" | "connecting" | "live" | "done" | "error";

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

export function useLiveVoiceSession(callId: string | null, active: boolean) {
  const [status, setStatus] = useState<LiveVoiceStatus>("idle");
  const [micOn, setMicOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const sessionRef = useRef<{ close: () => void } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const finishRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const endCall = useCallback(async () => {
    await finishRef.current?.();
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  useEffect(() => {
    if (!active || !callId) {
      return;
    }

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
      cleanupRef.current?.();
      cleanupRef.current = null;
      try {
        sessionRef.current?.close();
      } catch {
        /* ignore */
      }
      sessionRef.current = null;
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
        finishRef.current = () => finishCall(ctx);

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
              if (!cancelled) {
                setStatus("live");
                setStartedAt(Date.now());
              }
            },
            onmessage: (msg: {
              serverContent?: {
                inputTranscription?: { text?: string };
                outputTranscription?: { text?: string };
                modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
                turnComplete?: boolean;
              };
            }) => {
              if (cancelled) return;
              const sc = msg.serverContent;
              if (sc?.inputTranscription?.text) agentLine += sc.inputTranscription.text;
              if (sc?.outputTranscription?.text) shipperLine += sc.outputTranscription.text;

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
                const hasAgent = lines.some((l) => l.speaker === "agent");
                const hasShipper = lines.some((l) => l.speaker === "shipper");
                if (hasAgent && hasShipper && turnCount >= 2) void finishCall(ctx);
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
                  text: `Begin the customs call now. You are the English-speaking ClearBorder customs agent calling ${ctx.shipperName} about shipment ${ctx.trackingNumber}. Ask them to confirm invoice ${ctx.invoiceNumber} total ${ctx.currency} ${ctx.invoiceValue}. The shipper is on the line via microphone — listen to their responses and continue the conversation until they confirm the invoice total.`,
                },
              ],
            },
          ],
          turnComplete: true,
        });

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMicOn(true);
          const recCtx = new AudioContext({ sampleRate: 16000 });
          const source = recCtx.createMediaStreamSource(stream);
          const processor = recCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (ev) => {
            if (cancelled || mutedRef.current) return;
            const input = ev.inputBuffer.getChannelData(0);
            const pcm = new Int16Array(input.length);
            for (let i = 0; i < input.length; i++)
              pcm[i] = Math.max(-32768, Math.min(32767, input[i]! * 32768));
            const bytes = new Uint8Array(pcm.buffer);
            let binary = "";
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
            session.sendRealtimeInput({
              audio: { data: btoa(binary), mimeType: "audio/pcm;rate=16000" },
            });
          };
          source.connect(processor);
          processor.connect(recCtx.destination);

          cleanupRef.current = () => {
            stream.getTracks().forEach((t) => t.stop());
            processor.disconnect();
            source.disconnect();
            void recCtx.close();
          };
        } catch {
          setMicOn(false);
        }

        window.setTimeout(() => void finishCall(ctx), 45_000);
      } catch (err) {
        console.error("[useLiveVoiceSession]", err);
        setStatus("error");
      }
    }

    void runLiveSession();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      sessionRef.current?.close();
      sessionRef.current = null;
      finishRef.current = null;
    };
  }, [active, callId]);

  return { status, micOn, muted, startedAt, endCall, toggleMute };
}
