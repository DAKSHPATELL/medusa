"use client";

import { useCallback, useMemo, useState } from "react";
import type { CallView } from "@/lib/demo/useAgentStream";
import { agentPost } from "@/lib/demo/agent-api";
import { useLiveVoiceSession } from "@/lib/demo/useLiveVoiceSession";
import { IncomingCallOverlay } from "./IncomingCallOverlay";

interface LiveVoiceBridgeProps {
  call: CallView;
  voiceMode: "browser" | "twilio" | "mock" | null;
  trackingNumber?: string;
}

type CallPhase = "ringing" | "active" | null;

export function LiveVoiceBridge({ call, voiceMode, trackingNumber }: LiveVoiceBridgeProps) {
  const [acceptedCallId, setAcceptedCallId] = useState<string | null>(null);
  const [declinedCallIds, setDeclinedCallIds] = useState<Set<string>>(() => new Set());
  const [dismissedCallIds, setDismissedCallIds] = useState<Set<string>>(() => new Set());
  const [twilioBrowserFallback, setTwilioBrowserFallback] = useState(false);

  const callId = call.started?.callId ?? null;
  const showOverlay =
    voiceMode !== "mock" &&
    voiceMode !== null &&
    !!call.started &&
    !call.ended &&
    (voiceMode === "browser" || voiceMode === "twilio");

  const sessionActive = acceptedCallId === callId && !!callId && !call.ended;
  const { status, micOn, muted, startedAt, endCall, toggleMute } = useLiveVoiceSession(
    callId,
    sessionActive,
  );

  const phase: CallPhase = useMemo(() => {
    if (!showOverlay || !callId || call.ended) return null;
    if (declinedCallIds.has(callId) || dismissedCallIds.has(callId)) return null;
    if (acceptedCallId === callId && (status === "done" || status === "error")) return null;
    if (acceptedCallId === callId) return "active";
    return "ringing";
  }, [
    showOverlay,
    callId,
    call.ended,
    declinedCallIds,
    dismissedCallIds,
    acceptedCallId,
    status,
  ]);

  const onAccept = useCallback(() => {
    if (!callId) return;
    if (voiceMode === "twilio" && !twilioBrowserFallback) {
      setDismissedCallIds((prev) => new Set(prev).add(callId));
      return;
    }
    setAcceptedCallId(callId);
  }, [voiceMode, twilioBrowserFallback, callId]);

  const onDecline = useCallback(async () => {
    if (!callId) return;
    await agentPost(`/api/voice/${callId}/decline`).catch(() => {});
    setDeclinedCallIds((prev) => new Set(prev).add(callId));
  }, [callId]);

  const onBrowserFallback = useCallback(() => {
    if (!callId) return;
    setTwilioBrowserFallback(true);
    setAcceptedCallId(callId);
  }, [callId]);

  const onEndCall = useCallback(() => {
    void endCall();
  }, [endCall]);

  if (!phase) return null;

  return (
    <IncomingCallOverlay
      call={call}
      voiceMode={voiceMode}
      trackingNumber={trackingNumber}
      phase={phase}
      twilioBrowserFallback={twilioBrowserFallback || voiceMode === "browser"}
      liveStatus={status}
      micOn={micOn}
      muted={muted}
      startedAt={startedAt}
      onAccept={onAccept}
      onDecline={onDecline}
      onBrowserFallback={onBrowserFallback}
      onToggleMute={toggleMute}
      onEndCall={onEndCall}
    />
  );
}
