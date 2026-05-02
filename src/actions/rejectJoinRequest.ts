import { Action, actions, user, z } from "@botpress/runtime";
import { JoinRequestsTable } from "../tables/JoinRequests";

export const rejectJoinRequest = new Action({
  name: "rejectJoinRequest",
  description: "Leader/admin rejects a pending join request.",
  input: z.object({ joinRequestId: z.string(), reason: z.string().optional() }),
  output: z.object({ ok: z.boolean() }),
  async handler({ input }) {
    if (
      (user as any).state?.role !== "leader" &&
      (user as any).state?.role !== "admin"
    ) {
      throw new Error("rejectJoinRequest is leader/admin-only");
    }
    const id = Number(input.joinRequestId);
    const req = await JoinRequestsTable.getRow({ id } as any);
    if (!req) throw new Error("Join request not found");
    if (req.status !== "pending")
      throw new Error(`Join request already ${req.status}`);

    const decidedAt = new Date().toISOString();
    const decidedBy = (user as any).id ?? "unknown";

    await JoinRequestsTable.updateRows({
      rows: [{ id, status: "rejected", decidedBy, decidedAt } as any],
    });
    await (actions as any).logAudit({
      organizationId: req.organizationId,
      actorUserId: decidedBy,
      action: "join.reject",
      target: req.userId,
      payload: { joinRequestId: input.joinRequestId, reason: input.reason },
    });
    return { ok: true };
  },
});
