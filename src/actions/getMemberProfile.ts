import { Action, z } from "@botpress/runtime";
import { TemperatureEventsTable } from "../tables/TemperatureEvents";
import { TasksTable } from "../tables/Tasks";
import { ReviewsTable } from "../tables/Reviews";
import { ContributionEvidenceTable } from "../tables/ContributionEvidence";

export const getMemberProfile = new Action({
  name: "getMemberProfile",
  description:
    "Bundle for the Member Profile screen — temperature trend, recent tasks/reviews/evidence.",
  input: z.object({
    userId: z.string(),
    organizationId: z.string(),
  }),
  output: z.object({
    events: z.array(z.any()),
    tasks: z.array(z.any()),
    reviews: z.array(z.any()),
    evidence: z.array(z.any()),
    currentTemperature: z.number(),
  }),
  async handler({ input }) {
    const [
      { rows: events },
      { rows: tasks },
      { rows: reviews },
      { rows: evidence },
    ] = await Promise.all([
      TemperatureEventsTable.findRows({
        filter: {
          userId: input.userId,
          organizationId: input.organizationId,
        } as any,
        limit: 500,
      }),
      TasksTable.findRows({
        filter: { assigneeUserId: input.userId } as any,
        limit: 100,
      }),
      ReviewsTable.findRows({
        filter: { revieweeUserId: input.userId } as any,
        limit: 100,
      }),
      ContributionEvidenceTable.findRows({
        filter: { userId: input.userId } as any,
        limit: 100,
      }),
    ]);

    const sorted = (events as any[])
      .slice()
      .sort(
        (a, b) =>
          new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
      );
    const currentTemperature = sorted[sorted.length - 1]?.afterValue ?? 36.5;
    return {
      events: sorted,
      tasks: tasks as any[],
      reviews: reviews as any[],
      evidence: evidence as any[],
      currentTemperature,
    };
  },
});
