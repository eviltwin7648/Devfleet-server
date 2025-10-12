import type { Agent, AgentAPIKey } from "@prisma/client";
type User = {
    id: number;
    email: string;
};

declare global {
    namespace Express {
        interface Request {
            agent?: Agent;
            apiKeyRecord?: AgentAPIKey;
            user?: User;
        }
    }
}

export {};
