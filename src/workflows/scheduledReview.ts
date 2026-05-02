import { Workflow, actions, z } from "@botpress/runtime";
import { OrganizationsTable } from "../tables/Organizations";
import { GroupChatMembersTable } from "../tables/GroupChatMembers";

const SCHEDULE_BOUNDARY: Record<string, (now: Date) => boolean> = {
  weekly: (d) => d.getUTCDay() === 1, // Monday
  monthly: (d) => d.getUTCDate() === 1,
  quarterly: (d) =>
    d.getUTCDate() === 1 && [0, 3, 6, 9].includes(d.getUTCMonth()),
  semester: (d) => d.getUTCDate() === 1 && [0, 6].includes(d.getUTCMonth()),
  yearly: (d) => d.getUTCDate() === 1 && d.getUTCMonth() === 0,
  manual: () => false,
};

const PERIOD_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  semester: 182,
  yearly: 365,
  manual: 30,
};

/**
 * Daily 08:00 UTC: for each org whose review cadence boundary matches today,
 * generate performance reports for every active member.
 */
export const scheduledReview = new Workflow({
  name: "scheduledReview",
  description:
    "Daily check — fan out generatePerformanceReport per org cadence.",
  schedule: "0 8 * * *",
  input: z.object({}).default({}),
  output: z.object({ generated: z.number() }),
  async handler() {
    const now = new Date();
    const { rows: orgs } = await OrganizationsTable.findRows({
      filter: {} as any,
      limit: 500,
    });

    let generated = 0;
    for (const org of orgs as any[]) {
      const cadence = org.reviewSchedule ?? "monthly";
      const boundary = SCHEDULE_BOUNDARY[cadence];
      if (!boundary || !boundary(now)) continue;

      const days = PERIOD_DAYS[cadence] ?? 30;
      const periodStart = new Date(
        now.getTime() - days * 86_400_000,
      ).toISOString();
      const periodEnd = now.toISOString();

      const { rows: members } = await GroupChatMembersTable.findRows({
        filter: { organizationId: String(org.id), status: "active" } as any,
        limit: 1000,
      });
      for (const m of members as any[]) {
        try {
          await (actions as any).generatePerformanceReport({
            organizationId: String(org.id),
            conversationId: m.conversationId,
            userId: m.userId,
            period: cadence,
            periodStart,
            periodEnd,
          });
          generated += 1;
        } catch (err) {
          console.warn("[scheduledReview] failed for", m.userId, err);
        }
      }
    }
    return { generated };
  },
});
