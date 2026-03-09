/**
 * sse.service.ts
 *
 * Manages Server-Sent Events (SSE) connections for real-time dashboard updates.
 * When the ingest controller writes new jobs/profiles from data-collection,
 * it calls broadcastSSEEvent() which immediately notifies all connected dashboards.
 * The dashboard hooks (useLiveRefresh) trigger RTK Query refetch on receipt.
 */
import type { Response } from "express";

interface SSEClient {
  id: number;
  res: Response;
}

let nextId = 1;
const clients = new Map<number, SSEClient>();

/** Register a new SSE connection. Sends initial ping and cleans up on close. */
export function addSSEClient(res: Response): () => void {
  const id = nextId++;
  const client: SSEClient = { id, res };
  clients.set(id, client);

  // Keep-alive: send a comment every 25 seconds so proxies don't time out
  const heartbeat = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(heartbeat);
      clients.delete(id);
      return;
    }
    res.write(": ping\n\n");
  }, 25_000);

  const cleanup = () => {
    clearInterval(heartbeat);
    clients.delete(id);
  };

  res.on("close", cleanup);
  res.on("error", cleanup);

  return cleanup;
}

/** Broadcast a named SSE event to all connected clients. */
export function broadcastSSEEvent(
  event: string,
  data: Record<string, unknown>,
): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [id, client] of clients) {
    if (client.res.writableEnded) {
      clients.delete(id);
      continue;
    }
    try {
      client.res.write(payload);
    } catch {
      clients.delete(id);
    }
  }
}

export function getSSEClientCount(): number {
  return clients.size;
}
