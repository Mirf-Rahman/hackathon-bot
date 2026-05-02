import { Action, z } from "@botpress/runtime";
import { AuditLogsTable } from "../tables/AuditLogs";

export const logAudit = new Action({
  name: "logAudit",
  description:
    "Append a row to AuditLogsTable. Called from every leader/admin action.",
  input: z.object({
    organizationId: z.string(),
    actorUserId: z.string(),
    action: z.string(),
    target: z.string().optional(),
    payload: z.record(z.any()).optional(),
  }),
  output: z.object({ ok: z.boolean() }),
  async handler({ input }) {
    await AuditLogsTable.createRows({
      rows: [
        {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: input.action,
          target: input.target,
          payload: input.payload ?? {},
          at: new Date().toISOString(),
        },
      ],
    });
    return { ok: true };
  },
});
