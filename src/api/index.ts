import dotenv from "dotenv";
import { createServer } from "./server";
import { JobDispatcher, JobEvent } from "../lib/jobDispatcher";
import { LongPollManager } from "../modules/agents/longPollManager";
import { createServer as createHttpServer } from "http";
import { setupWebSocket } from "../lib/ws";

dotenv.config();

const PORT = process.env.PORT || 8000;

const app = createServer();
const server = createHttpServer(app);

// Initialize JobDispatcher for real-time events
JobDispatcher.initialize();

// Connect JobDispatcher to LongPollManager
// When a job is created, notify all waiting agents
JobDispatcher.on(JobEvent.CREATED, (payload) => {
  console.log(`📢 Job created: ${payload.executionId}, notifying waiting agents`);
  LongPollManager.notifyAll({ id: payload.executionId, ...payload });
});

// Setup WebSockets for real-time logs
setupWebSocket(server);

import { db } from "../db/db";

// Agent Disconnect Detection (every minute)
setInterval(async () => {
   const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
   try {
     const result = await db.agent.updateMany({
         where: { isOnline: true, lastSeen: { lt: twoMinutesAgo } },
         data: { isOnline: false }
     });
     if (result.count > 0) {
       console.log(`🔌 Marked ${result.count} agents as offline due to missed heartbeats.`);
     }
   } catch (e) {
     console.error("Disconnect detection error:", e);
   }
}, 60 * 1000);

server.listen(PORT, () => {
    console.log(`DevFleet Server is Up and running on port ${PORT}`);
});
