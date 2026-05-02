import { Table, z } from "@botpress/runtime";

export const AuditLogsTable = new Table({
  name: "AuditLogsTable",
  description: "Who did what, when, why — append-only audit trail.",
  columns: {
    organizationId: z.string(),
    actorUserId: z.string(),
    action: z.string(),
    target: z.string().optional(),
    payload: z.record(z.any()).default({}),
    at: z.string(),
  },
});
