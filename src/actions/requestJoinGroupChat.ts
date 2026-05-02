import { Action, actions, user, z } from "@botpress/runtime";
import { GroupChatsTable } from "../tables/GroupChats";
import { GroupChatMembersTable } from "../tables/GroupChatMembers";
import { JoinRequestsTable } from "../tables/JoinRequests";

export const requestJoinGroupChat = new Action({
  name: "requestJoinGroupChat",
  description:
    "Try to join a group chat. If the user's temperature is below the gate, queue a JoinRequest for the leader.",
  input: z.object({
    conversationId: z.string(),
    workRole: z
      .enum([
        "project_manager",
        "developer",
        "frontend",
        "backend",
        "fullstack",
        "it_support",
        "qa",
        "designer",
        "researcher",
        "analyst",
        "devops",
        "content_writer",
        "presenter",
        "other",
      ])
      .default("other"),
    justification: z.string().optional(),
  }),
  output: z.object({
    status: z.enum(["joined", "pending"]),
    joinRequestId: z.string().optional(),
  }),
  async handler({ input }) {
    const { rows: gcs } = await GroupChatsTable.findRows({
      filter: { conversationId: input.conversationId } as any,
      limit: 1,
    });
    const gc = (gcs as any[])[0];
    if (!gc) throw new Error(`Group chat ${input.conversationId} not found`);

    const userId = (user as any).id ?? "unknown";
    const temp = (user.state.temperature ?? 36.5) as number;
    const threshold = (
      gc.joinGateEnabled ? gc.minTemperatureToJoin : 0
    ) as number;

    if (temp >= threshold) {
      await GroupChatMembersTable.createRows({
        rows: [
          {
            conversationId: input.conversationId,
            organizationId: gc.organizationId,
            userId,
            workRole: input.workRole,
            joinedAt: new Date().toISOString(),
            status: "active",
          },
        ],
      });
      await (actions as any).logActivity({
        event: "gc.join",
        who: userId,
        what: gc.title,
        conversationId: input.conversationId,
      });
      return { status: "joined" };
    }

    const created = await JoinRequestsTable.createRows({
      rows: [
        {
          conversationId: input.conversationId,
          organizationId: gc.organizationId,
          userId,
          requesterTemperature: temp,
          status: "pending",
          justification: input.justification,
          requestedAt: new Date().toISOString(),
        },
      ],
    });
    const joinRequestId = String((created as any)?.rows?.[0]?.id ?? "");
    return { status: "pending", joinRequestId };
  },
});
