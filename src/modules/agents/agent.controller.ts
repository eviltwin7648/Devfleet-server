import crypto from "crypto";
import { Request, Response } from "express";
import { db } from "../../db/db";
// Register a new agent or update existing
const register = async (req: Request, res: Response) => {
    try {
        const { hostname, os, arch, totalmem, apiKey } = req.body;
        console.log("Regestring agent:", req.body);

        const normalizedHost = hostname.trim().toLowerCase();
        if (!hostname || !os || !arch || !totalmem || !apiKey) {
            res.status(400).json({ message: "Missing required fields" });
            return;
        }

        const apiKeyRecord = await db.agentAPIKey.findUnique({
            where: {
                apiKey,
            },
            include: { user: true },
        });
        if (!apiKeyRecord) {
            res.status(403).json({
                message: "API key is Invalid",
            });
            return;
        }
        if (apiKeyRecord.revokedAt) {
            res.status(403).json({ message: "API key has been revoked" });
            return;
        }
        if (apiKeyRecord.usedAt) {
            res.status(403).json({ message: "API key has already been used" });
            return;
        }
        // Upsert agent by hostname (or other unique field)
        const agent = await db.agent.upsert({
            where: { hostname: normalizedHost },
            update: {
                os,
                arch,
                totalmem,
                lastSeen: new Date(),
                apiKeyId: apiKeyRecord.id,
            },
            create: {
                hostname: normalizedHost,
                os,
                arch,
                totalmem,
                lastSeen: new Date(),
                apiKeyId: apiKeyRecord.id,
                userId: apiKeyRecord.userId,
            },
        });
        await db.agentAPIKey.update({
            where: { id: apiKeyRecord.id },
            data: { usedAt: new Date(), isUsed: true },
        });

        res.status(200).json({
            agent_id: agent.id,
            status: agent.lastSeen ? "updated" : "new",
            username: apiKeyRecord.user.name,
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to register agent", error: String(err) });
        console.error(err);
    }
};

// Heartbeat: update agent's lastSeen
const heartbeat = async (req: Request, res: Response) => {
    try {
        const { agent_id } = req.body;
        await db.agent.update({ where: { id: agent_id }, data: { lastSeen: new Date() } });
        res.status(200).json({ message: "Heartbeat received" });
    } catch (err) {
        res.status(500).json({ message: "Failed to update heartbeat", error: String(err) });
        console.error(err);
    }
};

// Poll for jobs assigned to this agent
const pullJobs = async (req: Request, res: Response) => {
    try {
        const agent_id = req.query.agent_id as string;
        // Find a pending job for this agent
        const job = await db.job.findFirst({ where: { agentId: Number(agent_id), status: "pending" } });
        if (job) {
            // Optionally mark as running
            await db.job.update({ where: { id: job.id }, data: { status: "running" } });
            res.status(200).json({ job });
        } else {
            res.status(200).json({ job: null });
        }
    } catch (err) {
        res.status(500).json({ message: "Failed to pull jobs", error: String(err) });
        console.error(err);
    }
};

// Receive job logs from agent
const jobLogs = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const { type, message } = req.body;
        // Save log to DB (or file, or forward to logging service)
        await db.log.create({ data: { jobId: Number(jobId), type, message } });
        res.status(200).json({ message: "Log received" });
    } catch (err) {
        res.status(500).json({ message: "Failed to save log", error: String(err) });
        console.error(err);
    }
};

// Receive job result from agent
const jobResult = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.params;
        const { status, exit_code } = req.body;
        await db.job.update({
            where: { id: Number(jobId) },
            data: { status, exitCode: exit_code, finishedAt: new Date() },
        });
        res.status(200).json({ message: "Job result received" });
    } catch (err) {
        res.status(500).json({ message: "Failed to save job result", error: String(err) });
        console.error(err);
    }
};

// Shutdown: mark agent as offline
const shutdown = async (req: Request, res: Response) => {
    try {
        const { agent_id } = req.body;
        await db.agent.update({ where: { id: agent_id }, data: { isOnline: false, lastSeen: new Date() } });
        res.status(200).json({ message: "Agent shutdown successfully" });
    } catch (err) {
        res.status(500).json({ message: "Failed to shutdown agent", error: String(err) });
        console.error(err);
    }
};

const generateApiKey = () => {
    const bytes = crypto.randomBytes(32);
    return "df_" + bytes.toString("hex");
};

const createApiKey = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(400).json({ message: "Missing user Id" });
            return;
        }
        const expiryQuery = req.query.expires;
        let expiryDate: Date; // This will now always be a Date object

        // Check if the user provided a custom expiry date
        if (typeof expiryQuery === "string") {
            const parsedDate = new Date(expiryQuery);
            if (isNaN(parsedDate.getTime())) {
                res.status(400).json({ message: "Invalid date format for expiry." });
                return;
            }
            expiryDate = parsedDate;
        } else {
            expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        }

        const newApiKey = generateApiKey();

        const apikey = await db.agentAPIKey.create({
            data: {
                userId,
                apiKey: newApiKey,
                expiresAt: expiryDate.toISOString(),
            },
        });
        res.status(200).json({
            message: `API key successfully generated`,
            apiKey: apikey.apiKey,
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to Generate API Key", error: String(err) });
        console.error(err);
    }
};

const getUserAgents = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(400).json({ message: "Missing user Id" });
            return;
        }
        const agents = await db.agent.findMany({
            where: {
                userId,
            },
            select: {
                id: true,
                hostname: true,
                os: true,
                arch: true,
                isOnline: true,
                lastSeen: true,
            },
        });

        res.json({
            message: "Agents Found Successfully",
            agents,
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to Fetch Agents", error: String(error) });
        console.error(error);
    }
};

export const agentController = {
    register,
    heartbeat,
    pullJobs,
    jobLogs,
    jobResult,
    shutdown,
    createApiKey,
    getUserAgents,
};
