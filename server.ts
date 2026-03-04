// Load .env before any other module (groq-sdk, elevenlabs, etc. read env at init time)
import "dotenv/config";

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import { handleVoiceConnection } from "./lib/voice-pipeline";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    void handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const { pathname, query } = parse(req.url!, true);

    if (pathname === "/api/voice/ws") {
      const sessionId = query.sessionId as string | undefined;
      if (!sessionId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        handleVoiceConnection(ws, sessionId);
      });
    } else {
      // Let Next.js handle other WebSocket connections (like HMR)
      // by not destroying the socket
    }
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
