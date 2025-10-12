import { Router } from "express";
import { userAuth } from "../../middleware/userAuth";
import { agentController } from "./agent.controller";

const router = Router();

router.post("/register", agentController.register);
router.post("'/heartbeat", agentController.heartbeat);
router.get("/jobs/pull", agentController.pullJobs);
router.post("/job/:jobId/logs", agentController.jobLogs);
router.post("/job/:jobId/result", agentController.jobResult);
router.post("/shutdown", agentController.shutdown);

//api key
router.get("/api-key", userAuth, agentController.createApiKey);

//dashboard
router.get("/my-agents", userAuth, agentController.getUserAgents);
export const agentRoutes = router;
