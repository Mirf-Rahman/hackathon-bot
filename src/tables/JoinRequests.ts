import { Table, z } from "@botpress/runtime";

export const JoinRequestsTable = new Table({
  name: "JoinRequestsTable",
  description:
    "Pending GC join requests when applicant is below minTemperatureToJoin.",
  columns: {
    conversationId: z.string(),
    organizationId: z.string(),
    userId: z.string(),
    requesterTemperature: z.number(),
    status: z.enum(["pending", "approved", "rejected"]).default("pending"),
    justification: z.string().optional(),
    decidedBy: z.string().optional(),
    decidedAt: z.string().optional(),
    requestedAt: z.string(),
  },
});
