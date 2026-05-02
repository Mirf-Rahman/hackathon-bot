import { Action, actions, user, z } from "@botpress/runtime";
import { GroupChatsTable } from "../tables/GroupChats";

export const closeProject = new Action({
  name: "closeProject",
  description:
    "Leader/admin: close a group chat (project) and trigger projectAudit.",
  input: z.object({ conversationId: z.string() }),
  output: z.object({ ok: z.boolean() }),
  async handler({ input }) {
    if (
      (user as any).state?.role !== "leader" &&
      (user as any).state?.role !== "admin"
    ) {
      throw new Error("closeProject is leader/admin-only");
    }
    const { rows } = await GroupChatsTable.findRows({
      filter: { conversationId: input.conversationId } as any,
      limit: 1,
    });
    const gc = (rows as any[])[0];
    if (!gc) throw new Error("Group chat not found");

    await GroupChatsTable.updateRows({
      rows: [
        { ...gc, status: "closed", closedAt: new Date().toISOString() } as any,
      ],
    });
    await (actions as any).logAudit({
      organizationId: gc.organizationId,
      actorUserId: (user as any).id ?? "unknown",
      action: "project.close",
      target: input.conversationId,
      payload: {},
    });
    // projectAudit workflow can be triggered here once defined.
    return { ok: true };
  },
});
