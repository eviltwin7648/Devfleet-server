import type { NextFunction, Request, Response } from "express";
import { db } from "../db/db";

export const agentAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const header = req.headers.authorization;
        if (!header?.startsWith("ApiKey ")) {
            res.status(401).json({
                message: "Missing or Invalid API Key header",
            });
            return;
        }
        const apiKey = header.split(" ")[1];
        const keyRecord = await db.agentAPIKey.findUnique({
            where: {
                apiKey,
            },
            include: { agent: true },
        });

        if (!keyRecord || keyRecord.revokedAt || !keyRecord.usedAt) {
            res.status(403).json({ message: "Invalid or Revoked API key" });
            return;
        }
        const isExpired = keyRecord.expiresAt ? keyRecord.expiresAt < new Date() : false;
        if (isExpired) {
            res.status(403).json({ message: "API key expired" });
            return;
        }

        if (!keyRecord.agent || !keyRecord.agent.isOnline) {
            res.status(403).json({ message: "Agent offline or not registered" });
            return;
        }

        req.agent = keyRecord.agent;
        req.apiKeyRecord = keyRecord;
        next();
    } catch (error) {
        res.json({ message: "Error While Authorization", error: String(error) });
        throw new Error(String(error));
    }
};
