import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { getSessionFromToken } from "../middleware/auth";
import { getLiveMetrics } from "./systemMetrics";

const liveMetricsPath = "/api/live/metrics";
const liveMetricsIntervalMs = 5000;

export function attachLiveMetrics(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "", "http://localhost");

    if (url.pathname !== liveMetricsPath) {
      return;
    }

    const token = url.searchParams.get("token");
    const session = token ? getSessionFromToken(token) : null;

    if (!session) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws);
    });
  });

  wss.on("connection", (ws) => {
    let closed = false;

    async function sendMetrics() {
      if (closed || ws.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        ws.send(JSON.stringify(await getLiveMetrics()));
      } catch {
        ws.send(JSON.stringify({ message: "Could not load live metrics.", type: "error" }));
      }
    }

    void sendMetrics();
    const interval = setInterval(() => void sendMetrics(), liveMetricsIntervalMs);

    ws.on("close", () => {
      closed = true;
      clearInterval(interval);
    });
  });
}
