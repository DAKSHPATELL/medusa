"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";
import type {
  AgentEvent,
  AgentEventOf,
  CaseRecord,
  DemoState,
  ServerMessage,
  Shipper,
} from "@clearborder/shared";
import { agentWsUrl } from "./agent-api";

/** An AgentEvent plus the local wall-clock ms it arrived (0 = backlog). */
export type ReceivedEvent = AgentEvent & { receivedAt: number };

export interface StreamState {
  connected: boolean;
  everConnected: boolean;
  events: ReceivedEvent[];
  cases: CaseRecord[];
  shippers: Shipper[];
  demo: DemoState | null;
}

type Action =
  | { type: "socket"; connected: boolean }
  | { type: "hello"; msg: Extract<ServerMessage, { kind: "hello" }> }
  | { type: "event"; event: AgentEvent; live: boolean }
  | { type: "state"; state: Extract<ServerMessage, { kind: "state" }>["state"] }
  | { type: "reset"; state: Extract<ServerMessage, { kind: "reset" }>["state"] };

const initialState: StreamState = {
  connected: false,
  everConnected: false,
  events: [],
  cases: [],
  shippers: [],
  demo: null,
};

function sortEvents(events: ReceivedEvent[]): ReceivedEvent[] {
  return [...events].sort((a, b) => a.seq - b.seq);
}

function reducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case "socket":
      return {
        ...state,
        connected: action.connected,
        everConnected: state.everConnected || action.connected,
      };
    case "hello":
      return {
        ...state,
        events: sortEvents(action.msg.events.map((e) => ({ ...e, receivedAt: 0 }))),
        cases: action.msg.state.cases,
        shippers: action.msg.state.shippers,
        demo: action.msg.state.demo,
      };
    case "event": {
      if (state.events.some((e) => e.id === action.event.id)) return state;
      const received: ReceivedEvent = {
        ...action.event,
        receivedAt: action.live ? Date.now() : 0,
      };
      return { ...state, events: sortEvents([...state.events, received]) };
    }
    case "state":
      return {
        ...state,
        cases: action.state.cases,
        shippers: action.state.shippers,
        demo: action.state.demo,
      };
    case "reset":
      return {
        ...state,
        events: [],
        cases: action.state.cases,
        shippers: action.state.shippers,
        demo: action.state.demo,
      };
    default:
      return state;
  }
}

export function useAgentStream(): StreamState {
  const [state, dispatch] = useReducer(reducer, initialState);
  const helloSeenRef = useRef(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(agentWsUrl());
      } catch {
        retry = setTimeout(connect, 1800);
        return;
      }
      ws.onopen = () => dispatch({ type: "socket", connected: true });
      ws.onmessage = (raw) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(raw.data)) as ServerMessage;
        } catch {
          return;
        }
        switch (msg.kind) {
          case "hello":
            dispatch({ type: "hello", msg });
            helloSeenRef.current = true;
            break;
          case "event":
            dispatch({ type: "event", event: msg.event, live: helloSeenRef.current });
            break;
          case "state":
            dispatch({ type: "state", state: msg.state });
            break;
          case "reset":
            dispatch({ type: "reset", state: msg.state });
            break;
        }
      };
      ws.onclose = () => {
        dispatch({ type: "socket", connected: false });
        if (!closed) retry = setTimeout(connect, 1800);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, []);

  return state;
}

export interface CallView {
  started: AgentEventOf<"call.started"> | null;
  ended: AgentEventOf<"call.ended"> | null;
  transcripts: Array<
    ReceivedEvent & { type: "call.transcript_partial" | "call.transcript_final" }
  >;
  live: boolean;
}

export function useDerived(state: StreamState, selectedCaseId: string | null) {
  return useMemo(() => {
    const caseEvents = state.events.filter(
      (e) => !selectedCaseId || !e.caseId || e.caseId === selectedCaseId,
    );

    let pendingApproval: AgentEventOf<"approval.requested"> | null = null;
    const decided = new Set<string>();
    for (const e of caseEvents) {
      if (e.type === "approval.granted" || e.type === "approval.rejected") {
        decided.add(e.approvalId);
      }
    }
    for (let i = caseEvents.length - 1; i >= 0; i--) {
      const e = caseEvents[i];
      if (e && e.type === "approval.requested" && !decided.has(e.approvalId)) {
        pendingApproval = e;
        break;
      }
      if (e && e.type === "approval.requested") break;
    }

    let started: AgentEventOf<"call.started"> | null = null;
    for (let i = caseEvents.length - 1; i >= 0; i--) {
      const e = caseEvents[i];
      if (e && e.type === "call.started") {
        started = e;
        break;
      }
    }
    const transcripts = caseEvents.filter(
      (e): e is ReceivedEvent & { type: "call.transcript_partial" | "call.transcript_final" } =>
        (e.type === "call.transcript_partial" || e.type === "call.transcript_final") &&
        (!started || e.callId === started.callId),
    );
    const ended =
      (caseEvents.find(
        (e) => e.type === "call.ended" && (!started || e.callId === started.callId),
      ) as AgentEventOf<"call.ended"> | undefined) ?? null;
    const call: CallView = { started, ended, transcripts, live: !!started && !ended };

    let lastShot: AgentEventOf<"browser.screenshot"> | null = null;
    let lastAction: AgentEventOf<"browser.action"> | null = null;
    for (let i = caseEvents.length - 1; i >= 0; i--) {
      const e = caseEvents[i];
      if (!lastShot && e?.type === "browser.screenshot") lastShot = e;
      if (!lastAction && e?.type === "browser.action") lastAction = e;
      if (lastShot && lastAction) break;
    }

    const memoryOps = caseEvents.filter(
      (e): e is ReceivedEvent & { type: "memory.read" | "memory.write" } =>
        e.type === "memory.read" || e.type === "memory.write",
    );

    return {
      caseEvents,
      pendingApproval,
      call,
      browser: { lastShot, lastAction },
      memoryOps,
    };
  }, [state.events, selectedCaseId]);
}
