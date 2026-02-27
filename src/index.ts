import { createServer } from "http";
import { parse } from "url";
import { env } from "./config/env";
import { connectMongo } from "./config/mongoose";
import app from "./app";
import { createCountsWebSocket } from "./services/ws-counts.service";
import { createPublicDataWebSocket } from "./services/ws-public-data.service";

async function main() {
  await connectMongo();

  const server = createServer(app);

  // Create WebSocket servers in noServer mode
  const countsWss = createCountsWebSocket();
  const publicDataWss = createPublicDataWebSocket();

  // Route HTTP upgrade requests to the correct WSS by pathname
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "");

    if (pathname === "/ws/counts") {
      countsWss.handleUpgrade(req, socket, head, (ws) => {
        countsWss.emit("connection", ws, req);
      });
    } else if (pathname === "/ws/public-data") {
      publicDataWss.handleUpgrade(req, socket, head, (ws) => {
        publicDataWss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(env.PORT, () => {
    console.log(
      `[Server] matchdb-jobs-services running on port ${env.PORT} (${env.NODE_ENV})`,
    );
  });
}

main().catch((err) => {
  console.error("[Fatal] Server failed to start:", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  const mongoose = await import("mongoose");
  await mongoose.default.disconnect();
  process.exit(0);
});
