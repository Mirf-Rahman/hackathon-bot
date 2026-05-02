import { Workflow, actions, z } from "@botpress/runtime";
import { GroupChatMembersTable } from "../tables/GroupChatMembers";

/**
 * Triggered when a project (group chat) closes. Generates a performance
 * report for every active member over the project window.
 */
export const projectAudit = new Workflow({
  name: "projectAudit",
  description:
    "Generate performance reports for every member of a closed project.",
  input: z.object({
    organizationId: z.string(),
    conversationId: z.string(),
    periodStart: z.string(),
    periodEnd: z.string().optional(),
  }),
  output: z.object({ reports: z.number() }),
  async handler({ input, step }) {
    const periodEnd = input.periodEnd ?? new Date().toISOString();

    const { rows: members } = await step("fetch_members", async () =>
      GroupChatMembersTable.findRows({
        filter: { conversationId: input.conversationId } as any,
        limit: 500,
      }),
    );

    let reports = 0;
    for (const m of members as any[]) {
      await step(`report_${m.userId}`, async () => {
        await (actions as any).generatePerformanceReport({
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          userId: m.userId,
          period: "custom",
          periodStart: input.periodStart,
          periodEnd,
        });
        reports += 1;
      });
    }
    return { reports };
  },
});
