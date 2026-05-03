import { Action, actions, user, z } from "@botpress/runtime";
import { JoinRequestsTable } from "../tables/JoinRequests";
import { GroupChatMembersTable } from "../tables/GroupChatMembers";

export const approveJoinRequest = new Action({
  name: "approveJoinRequest",
  description:
    "Leader/admin approves a pending join request and adds the member.",
  input: z.object({ joinRequestId: z.string() }),
  output: z.object({ ok: z.boolean() }),
  async handler({ input }) {
    if (
      (user as any).state?.role !== "leader" &&
      (user as any).state?.role !== "admin"
    ) {
      throw new Error("approveJoinRequest is leader/admin-only");
    }
    const id = Number(input.joinRequestId);
    const req = await JoinRequestsTable.getRow({ id } as any);
    if (!req) throw new Error("Join request not found");
    if (req.status !== "pending")
      throw new Error(`Join request already ${req.status}`);

    const decidedAt = new Date().toISOString();
    const decidedBy = (user as any).id ?? "unknown";

    await JoinRequestsTable.updateRows({
      rows: [{ id, status: "approved", decidedBy, decidedAt } as any],
    });
    await GroupChatMembersTable.createRows({
      rows: [
        {
          conversationId: req.conversationId,
          organizationId: req.organizationId,
          userId: req.userId,
          workRole: "other",
          leaderFlag: false,
          joinedAt: decidedAt,
          status: "active",
        },
      ],
    });
    await (actions as any).logAudit({
      organizationId: req.organizationId,
      actorUserId: decidedBy,
      action: "join.approve",
      target: req.userId,
      payload: { joinRequestId: input.joinRequestId },
    });
    return { ok: true };
  },
});
