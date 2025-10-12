import { Request, Response } from "express";
import { db } from "../../db/db";

const createJob = async (req: Request, res: Response) => {
  try {
    // Logic to create a job
    const { agentId, script, env, title, description } = req.body;

    if (!agentId || !script || !title) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("Creating job with data:", req.body);

    const job = await db.job.create({
      data: {
        title,
        description: description || "",
        agentId:1,
        script,
        env: env || {},
        status: "pending", // Initial status
        
      },
    });

    if (!job) {
      res.status(500).json({ error: "Failed to create job" });
      return;
    }


    //TODO: will just assume job is to be run immediately, will need to handle scheduling later



    res.status(201).json({ message: "Job created successfully" });
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
};

const listJobs = async (req: Request, res: Response) => {
  try {
    // Logic to list jobs
    res.status(200).json({ message: "List of jobs" });
  } catch (error) {
    res.status(500).json({ error: "Failed to list jobs" });
  }
};

const getJob = async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    // Logic to get a specific job by jobId
    res.status(200).json({ message: `Details of job ${jobId}` });
  } catch (error) {
    res.status(500).json({ error: "Failed to get job" });
  }
};

const updateJob = async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    // Logic to update a specific job by jobId
    res.status(200).json({ message: `Job ${jobId} updated successfully` });
  } catch (error) {
    res.status(500).json({ error: "Failed to update job" });
  }
};

const deleteJob = async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    // Logic to delete a specific job by jobId
    res.status(200).json({ message: `Job ${jobId} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete job" });
  }
};

export const jobController = {
  createJob,
  listJobs,
  getJob,
  updateJob,
  deleteJob,
};
