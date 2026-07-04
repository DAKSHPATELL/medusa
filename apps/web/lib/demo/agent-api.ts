"use client";

const port = process.env.NEXT_PUBLIC_AGENT_PORT ?? "8787";

export function agentHttpBase(): string {
  if (typeof window === "undefined") return `http://localhost:${port}`;
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

export function agentWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.hostname}:${port}/ws`;
}

export async function agentPost(path: string, body?: unknown): Promise<Response> {
  return fetch(`${agentHttpBase()}${path}`, {
    method: "POST",
    ...(body === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
}
