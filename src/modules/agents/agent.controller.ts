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
      data: { usedAt: new Date(), isUsed: true, agentId: agent.id },
    });

    res.status(200).json({
      agent_id: agent.id,
      status: agent.lastSeen ? "updated" : "new",
      username: apiKeyRecord.user.name,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to register agent", error: String(err) });
    console.error(err);
  }
};

import jwt from "jsonwebtoken";

// Heartbeat: update agent's lastSeen
const heartbeat = async (req: Request, res: Response) => {
  try {
  //from agentAuth middleware
    const agentId = req.agent?.id;
    if (!agentId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    await db.agent.update({
      where: { id: agentId },
      data: { lastSeen: new Date() },
    });
    console.log("HEARTBEAT RECEIVED from agent", agentId)
    res.status(200).json({ message: "Heartbeat received" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update heartbeat", error: String(err) });
    console.error(err);
  }
};

// Poll for jobs assigned to this agent (with long-polling support)
const pullJobs = async (req: Request, res: Response) => {
  try {
    //from agentAuth middleware
    console.log("PULLING JOBS", req.agent)
    const agentId = req.agent?.id;
    if (!agentId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    console.log("Polling jobs for Agent ID:", agentId)
    
    // Check if this is a long-poll request (header or query param)
    const enableLongPoll = req.query.longPoll === "true" || req.headers["x-long-poll"] === "true";
    
    // Helper function to find and claim a job
    const findAndClaimJob = async () => {
      // First, try to find a job already DISPATCHED to this agent
      let execution = await db.jobExecution.findFirst({
        where: { 
          agentId: agentId, 
          status: "DISPATCHED" 
        },
        include: {
          job: true,
        },
      });
      
      // If no dispatched job, try to claim a CREATED job (unassigned)
      if (!execution) {
        execution = await db.jobExecution.findFirst({
          where: {
            status: "CREATED",
            agentId: null, // Not assigned to any agent yet
          },
          include: {
            job: true,
          },
          orderBy: {
            scheduledAt: "asc", // Process oldest first
          },
        });

        // Claim the job by assigning it to this agent
        if (execution) {
          execution = await db.jobExecution.update({
            where: { id: execution.id },
            data: {
              agentId: agentId,
              status: "DISPATCHED",
            },
            include: {
              job: true,
            },
          });
          console.log(`✅ Agent ${agentId} claimed job ${execution.id}`);
        }
      }
      
      return execution;
    };

    // Try to find a job immediately
    let execution = await findAndClaimJob();
    
    if (execution) {
      // Job found - mark as running and return
      await db.jobExecution.update({
        where: { id: execution.id },
        data: { 
          status: "RUNNING",
          startedAt: new Date(),
        },
      });
      res.status(200).json({ job: execution });
    } else if (enableLongPoll) {
      // No job available, but long-polling enabled - wait for a job
      console.log(`⏳ Agent ${agentId} entering long-poll mode`);
      
      const { LongPollManager } = await import("./longPollManager");
      
      // Wait for a job event (30 second timeout)
      const jobEvent = await LongPollManager.waitForJob(agentId, 30000);
      
      if (jobEvent) {
        // Job became available during wait - try to claim it
        execution = await findAndClaimJob();
        
        if (execution) {
          await db.jobExecution.update({
            where: { id: execution.id },
            data: { 
              status: "RUNNING",
              startedAt: new Date(),
            },
          });
          res.status(200).json({ job: execution });
        } else {
          // Race condition - another agent claimed it
          res.status(200).json({ job: null });
        }
      } else {
        // Timeout - no job available
        res.status(200).json({ job: null });
      }
    } else {
      // No job and long-polling disabled (backward compatible)
      res.status(200).json({ job: null });
    }
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to pull jobs", error: String(err) });
    console.error(err);
  }
};


// Receive job logs from agent
const jobLogs = async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const { type, message } = req.body;
    // Save log to DB (or file, or forward to logging service)
    await db.log.create({ 
      data: { 
        executionId: executionId, 
        type, 
        message 
      } 
    });
    res.status(200).json({ message: "Log received" });
  } catch (err) {
    res.status(500).json({ message: "Failed to save log", error: String(err) });
    console.error(err);
  }
};

// Receive job result from agent
const jobResult = async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const { status, exit_code, stdout, stderr } = req.body;
    console.log("JOB RESULT RECEIVED", executionId, req.body);
    
    // Update JobExecution with result
    await db.jobExecution.update({
      where: { id: executionId },
      data: { 
        status: status.toUpperCase(), // Ensure uppercase to match enum
        exitCode: exit_code, 
        finishedAt: new Date(),
      },
    });

    if(stdout) {
        await db.log.create({
            data: {
                executionId: executionId,
                type: "STDOUT",
                message: stdout
            }
        });
    }

    if(stderr) {
        await db.log.create({
            data: {
                executionId: executionId,
                type: "STDERR",
                message: stderr
            }
        });
    }

    res.status(200).json({ message: "Job result received" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to save job result", error: String(err) });
    console.error(err);
  }
};

// Shutdown: mark agent as offline
const shutdown = async (req: Request, res: Response) => {
  try {
    const agentId = req.agent?.id;
     if (!agentId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    await db.agent.update({
      where: { id: agentId },
      data: { isOnline: false, lastSeen: new Date() },
    });
    res.status(200).json({ message: "Agent shutdown successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to shutdown agent", error: String(err) });
    console.error(err);
  }
};

const generateApiKey = () => {
  const bytes = crypto.randomBytes(32);
  return "df_" + bytes.toString("hex");
};

interface ApiKeyQuery {
  keyName?: string;
  expires?: string;
}

// Params, ResBody, ReqBody, ReqQuery
type ApiKeyRequest = Request<{}, {}, {}, ApiKeyQuery>;

const createApiKey = async (req: ApiKeyRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(400).json({ message: "Missing user Id" });
      return;
    }
    const expiryQuery = req.query.expires;
    const keyName = req.query.keyName;
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
        keyName: keyName,
        expiresAt: expiryDate.toISOString(),
      },
    });
    res.status(200).json({
      message: `API key successfully generated`,
      apiKey: apikey.apiKey,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to Generate API Key", error: String(err) });
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
    res
      .status(500)
      .json({ message: "Failed to Fetch Agents", error: String(error) });
    console.error(error);
  }
};

const verifyAgent = async (req: Request, res: Response) => {
  try {
    console.log("VERIFY REQUEST RECEIVED", req.body)
    const { apiKey, hostname, os, arch } = req.body;
    if(!apiKey){
      res.status(400).json({ message: "Missing API Key" });
      return;
    }
    
    // Find the API key record
    const apiKeyRecord = await db.agentAPIKey.findFirst({
      where: { apiKey: apiKey as string },
      include: { agent: true }
    });

    if (!apiKeyRecord) {
      res.status(400).json({ message: "Invalid API Key" });
      return;
    }

if(!apiKeyRecord.agent){
  res.status(400).json({ message: "Agent not found" });
  return;
}
    // Existing agent linked to key
    const agent = apiKeyRecord.agent;
    
    // Validate match
     if (agent.hostname !== hostname || agent.os !== os || agent.arch !== arch) {
          res.status(400).json({ message: "Machine details mismatch with registered agent" });
          console.error("Machine details mismatch during verify", { registered: agent, received: req.body });
          return;
    }

    const token = jwt.sign(
        { id: agent.id, hostname: agent.hostname },
        process.env.JWT_SECRET || "default_secret",
         { expiresIn: "10d" }
    );

    res.status(200).json({ message: "Verified", token });

  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to Verify API Key", error: String(error) });
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
  verifyAgent,
  // pollJobs
};
