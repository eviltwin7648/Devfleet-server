import dotenv from "dotenv";
import { createServer } from "./server";
import { JobDispatcher, JobEvent } from "../lib/jobDispatcher";
import { LongPollManager } from "../modules/agents/longPollManager";

dotenv.config();

const PORT = process.env.PORT || 8000;

const app = createServer();

// Initialize JobDispatcher for real-time events
JobDispatcher.initialize();

// Connect JobDispatcher to LongPollManager
// When a job is created, notify all waiting agents
JobDispatcher.on(JobEvent.CREATED, (payload) => {
  console.log(`📢 Job created: ${payload.executionId}, notifying waiting agents`);
  LongPollManager.notifyAll({ id: payload.executionId, ...payload });
});

app.listen(PORT, () => {
    console.log(`DevFleet Server is Up and running on port ${PORT}`);
});
