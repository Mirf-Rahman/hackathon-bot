import { Action, z } from "@botpress/runtime";
import { GroupChatMembersTable } from "../tables/GroupChatMembers";
import { TemperatureEventsTable } from "../tables/TemperatureEvents";

/**
 * Aggregate-by-Action read model for the GC leaderboard. Frontend can call
 * this instead of stitching findTableRows on the client.
 */
export const listLeaderboard = new Action({
  name: "listLeaderboard",
  description:
    "Return ranked members of a group chat with current temperature + 7-day delta.",
  input: z.object({
    conversationId: z.string(),
  }),
  output: z.object({
    members: z.array(
      z.object({
        userId: z.string(),
        workRole: z.string(),
        currentTemperature: z.number(),
        delta7d: z.number(),
      }),
    ),
  }),
  async handler({ input }) {
    const { rows: members } = await GroupChatMembersTable.findRows({
      filter: { conversationId: input.conversationId, status: "active" } as any,
      limit: 200,
    });
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;

    const enriched = await Promise.all(
      (members as any[]).map(async (m) => {
        const { rows: events } = await TemperatureEventsTable.findRows({
          filter: {
            userId: m.userId,
            conversationId: input.conversationId,
          } as any,
          limit: 200,
        });
        const sorted = (events as any[])
          .slice()
          .sort(
            (a, b) =>
              new Date(a.occurredAt).getTime() -
              new Date(b.occurredAt).getTime(),
          );
        const last = sorted[sorted.length - 1];
        const currentTemperature = last?.afterValue ?? 36.5;
        const baseline =
          sorted.find((e) => new Date(e.occurredAt).getTime() >= sevenDaysAgo)
            ?.beforeValue ?? currentTemperature;
        return {
          userId: m.userId,
          workRole: m.workRole ?? "other",
          currentTemperature,
          delta7d: currentTemperature - baseline,
        };
      }),
    );

    enriched.sort((a, b) => b.currentTemperature - a.currentTemperature);
    return { members: enriched };
  },
});
