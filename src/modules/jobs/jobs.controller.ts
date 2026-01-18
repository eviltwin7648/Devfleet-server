import { Request, Response } from "express";
import { db } from "../../db/db";

const createJob = async (req: Request, res: Response) => {
  try {
    // Logic to create a job
    const {
      agentId,
      script,
      env,
      title,
      description,
      scheduleAt,
      repeatCron,
      tags,
      isRecurring,
    } = req.body;
    const userId = req.user?.id;
    if (!agentId || !script || !title) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }
    if (!userId) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    console.log("Creating job with data:", req.body);

    const job = await db.job.create({
      data: {
        title,
        description: description || "",
        agentId,
        script,
        env: env || {},
        status: "Pending",
        userId: userId,
        scheduleAt,
        repeatCron,
        isRecurring,
        tags,
      },
    });

    if (!job) {
      res.status(500).json({ message: "Failed to create job" });
      return;
    }

    //TODO: will just assume job is to be run immediately, will need to handle scheduling later

    res.status(201).json({ message: "Job created successfully" });
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ message: "Failed to create job" });
  }
};

const getJobs = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    // console.log("INSIFE getJobs COntroller")
    if (!userId) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }
    const jobs = await db.job.findMany({
      where: {
        userId,
      },
      // select: {
      //   id: true,
      //   title: true,
      //   description: true,
      //   exitCode: true,
      //   scheduleAt: true,

        // agent: {
        //   select: {
        //     id: true,
        //     hostname: true,
        //     os: true,
        //     arch: true,
        //     totalmem: true,
        //     lastSeen: true,
        //     isOnline: true,
        //   },
        // },
      },
    // }
  );
// jobs.forEach(j => {
//   if (typeof j.agent?.totalmem === "bigint") {
//     console.log("totalmem is BigInt");
//   }
// });

    res.status(200).json({ message: "Jobs Found", data: jobs });
  } catch (error) {
    console.error("Error listing jobs:", error);
    res.status(500).json({ error: "Failed to list jobs" });
  }
};

const getJob = async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    // Logic to get a specific job by jobId
    const job = await db.job.findUnique({
      where: { id: jobId },
      include: {
        agent: {
          select: {
            id: true,
            hostname: true,
            os: true,
          },
        },
        logs: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!job) {
      res.status(404).json({ message: "Job not found" });
      return;
    }

    res.status(200).json(job);
  } catch (error) {
    console.error("Error getting job:", error);
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
  getJobs,
  getJob,
  updateJob,
  deleteJob,
};
