import { Router } from "express";
import { jobController } from "./jobs.controller";
import { userAuth } from "../../middleware/userAuth";

const router = Router();

router.post("/create", userAuth, jobController.createJob);
router.get("/all", userAuth, jobController.getJobs);
router.get("/get/:jobId", userAuth, jobController.getJob);
router.put("/update/:jobId", userAuth, jobController.updateJob);
router.delete("/delete/:jobId", userAuth, jobController.deleteJob);

export const jobRoutes = router;
