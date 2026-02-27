import { WebSocketServer, WebSocket } from "ws";
import { Job } from "../models/Job.model";
import { CandidateProfile } from "../models/CandidateProfile.model";

let prevJobCount = -1;
let prevProfileCount = -1;

/** Returns a small random delta: −3 to +3, never 0 */
function jitter(): number {
  let d = 0;
  while (d === 0) d = Math.floor(Math.random() * 7) - 3; // range −3..+3
  return d;
}

async function fetchCounts(): Promise<{ jobs: number; profiles: number }> {
  const [realJobs, realProfiles] = await Promise.all([
    Job.countDocuments({ isActive: true }),
    CandidateProfile.countDocuments(),
  ]);

  let displayJobs = realJobs;
  let displayProfiles = realProfiles;

  if (realJobs === prevJobCount) {
    displayJobs = Math.max(1, realJobs + jitter());
  }
  if (realProfiles === prevProfileCount) {
    displayProfiles = Math.max(1, realProfiles + jitter());
  }

  prevJobCount = realJobs;
  prevProfileCount = realProfiles;

  return { jobs: displayJobs, profiles: displayProfiles };
}

/**
 * Creates a WebSocketServer in noServer mode (caller routes upgrades).
 * Broadcasts { jobs, profiles } counts every 30 s.
 * Sends an immediate snapshot on new connections.
 */
export function createCountsWebSocket(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  console.log("[WS] Counts WebSocket ready (noServer) — /ws/counts");

  // Send counts immediately on new connection
  wss.on("connection", async (ws: WebSocket) => {
    try {
      const counts = await fetchCounts();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(counts));
      }
    } catch { /* ignore */ }
  });

  // Broadcast loop — every 30 seconds
  setInterval(async () => {
    if (wss.clients.size === 0) return;
    try {
      const counts = await fetchCounts();
      const payload = JSON.stringify(counts);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    } catch { /* silently skip */ }
  }, 30_000);

  return wss;
}
