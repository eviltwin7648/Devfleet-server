import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { agentRoutes } from "../modules/agents/agent.routes";
import { authRoutes } from "../modules/auth/auth.routes";
import { jobRoutes } from "../modules/jobs/jobs.routes";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use(cookieParser());

app.use(express.urlencoded({ extended: true }));

app.use(cors({ origin: "http://localhost:5173", credentials: true })); // Allow all origins for development

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/agent", agentRoutes);
app.use("/api/v1/jobs", jobRoutes);

app.listen(PORT, () => {
    console.log("DevFleet Server is Up and running on port " + PORT);
});
