import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { getSessionFromToken } from "../middleware/auth";
import { getLiveMetrics } from "./systemMetrics";

const liveMetricsPath = "/api/live/metrics";
const allowedLiveMetricsIntervals = [5000, 10000, 30000, 60000] as const;

function getLiveMetricsInterval(url: URL) {
  const requestedInterval = Number(url.searchParams.get("intervalMs"));

  return allowedLiveMetricsIntervals.includes(
    requestedInterval as (typeof allowedLiveMetricsIntervals)[number],
  )
    ? requestedInterval
    : 5000;
}

export function attachLiveMetrics(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  const liveIntervals = new WeakMap<WebSocket, number>();

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

    const intervalMs = getLiveMetricsInterval(url);

    wss.handleUpgrade(req, socket, head, (ws) => {
      liveIntervals.set(ws, intervalMs);
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    const intervalMs = liveIntervals.get(ws) ?? 5000;
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
    const interval = setInterval(() => void sendMetrics(), intervalMs);

    ws.on("close", () => {
      closed = true;
      clearInterval(interval);
    });
  });
}
