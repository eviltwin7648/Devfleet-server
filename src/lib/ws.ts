import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";

const executionClients = new Map<string, Set<WebSocket>>();

export const setupWebSocket = (server: Server) => {
  const wss = new WebSocketServer({ server, path: "/api/v1/logs/stream" });

  wss.on("connection", (ws, req) => {
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const executionId = url.searchParams.get("executionId");
      
      if (executionId) {
        if (!executionClients.has(executionId)) {
          executionClients.set(executionId, new Set());
        }
        executionClients.get(executionId)!.add(ws);

        ws.on("close", () => {
          executionClients.get(executionId)?.delete(ws);
          if (executionClients.get(executionId)?.size === 0) {
            executionClients.delete(executionId);
          }
        });
      } else {
        ws.close(1008, "Missing executionId");
      }
    } catch (e) {
      ws.close(1011, "Internal error");
    }
  });
  
  console.log("WebSocket server initialized for log streaming");
};

export const broadcastLogs = (executionId: string, logs: any[]) => {
  const clients = executionClients.get(executionId);
  if (clients) {
    const payload = JSON.stringify({ type: "logs", executionId, logs });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
};
