import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { Job } from "../models/Job.model";
import { CandidateProfile } from "../models/CandidateProfile.model";

let wss: WebSocketServer | null = null;
let prevJobCount = -1;
let prevProfileCount = -1;

/** Returns a small random delta: −3 to +3, never 0 */
function jitter(): number {
  let d = 0;
  while (d === 0) d = Math.floor(Math.random() * 7) - 3; // range −3..+3
  return d;
}

/**
 * Attaches a WebSocket server to the existing HTTP server.
 * Broadcasts { jobs: number, profiles: number } to every connected client
 * every 30 seconds. If the real count hasn't changed since last broadcast,
 * a small random delta is applied so the UI feels alive.
 */
export function initCountsWebSocket(server: HttpServer): void {
  wss = new WebSocketServer({ server, path: "/ws/counts" });

  console.log("[WS] Counts WebSocket listening on /ws/counts");

  // Broadcast loop — every 30 seconds
  setInterval(async () => {
    if (!wss || wss.clients.size === 0) return;

    try {
      const [realJobs, realProfiles] = await Promise.all([
        Job.countDocuments({ isActive: true }),
        CandidateProfile.countDocuments(),
      ]);

      // If count unchanged, nudge it randomly so the UI feels real-time
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

      const payload = JSON.stringify({
        jobs: displayJobs,
        profiles: displayProfiles,
      });

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    } catch {
      // silently skip on DB errors
    }
  }, 30000);
}
