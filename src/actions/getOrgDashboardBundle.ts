import { Action, z } from "@botpress/runtime";
import { GroupChatsTable } from "../tables/GroupChats";
import { AuditLogsTable } from "../tables/AuditLogs";
import { GroupChatMembersTable } from "../tables/GroupChatMembers";
import { TemperatureEventsTable } from "../tables/TemperatureEvents";

export const getOrgDashboardBundle = new Action({
  name: "getOrgDashboardBundle",
  description: "One-shot read model for the Org Dashboard screen.",
  input: z.object({ organizationId: z.string() }),
  output: z.object({
    groupChats: z.array(z.any()),
    auditLogs: z.array(z.any()),
    topMembers: z.array(
      z.object({
        userId: z.string(),
        currentTemperature: z.number(),
        conversationId: z.string(),
      }),
    ),
  }),
  async handler({ input }) {
    const [{ rows: gcs }, { rows: audits }, { rows: members }] =
      await Promise.all([
        GroupChatsTable.findRows({
          filter: { organizationId: input.organizationId } as any,
          limit: 200,
        }),
        AuditLogsTable.findRows({
          filter: { organizationId: input.organizationId } as any,
          limit: 50,
        }),
        GroupChatMembersTable.findRows({
          filter: {
            organizationId: input.organizationId,
            status: "active",
          } as any,
          limit: 500,
        }),
      ]);

    const enriched = await Promise.all(
      (members as any[]).map(async (m) => {
        const { rows: events } = await TemperatureEventsTable.findRows({
          filter: { userId: m.userId, conversationId: m.conversationId } as any,
          limit: 100,
        });
        const sorted = (events as any[])
          .slice()
          .sort(
            (a, b) =>
              new Date(a.occurredAt).getTime() -
              new Date(b.occurredAt).getTime(),
          );
        return {
          userId: m.userId,
          conversationId: m.conversationId,
          currentTemperature: sorted[sorted.length - 1]?.afterValue ?? 36.5,
        };
      }),
    );
    enriched.sort((a, b) => b.currentTemperature - a.currentTemperature);

    return {
      groupChats: gcs as any[],
      auditLogs: (audits as any[]).slice(0, 50),
      topMembers: enriched.slice(0, 10),
    };
  },
});
