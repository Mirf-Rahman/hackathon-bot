import { Action, actions, user, z } from "@botpress/runtime";
import { ReviewsTable } from "../tables/Reviews";
import { OrganizationsTable } from "../tables/Organizations";

export const submitLeaderReview = new Action({
  name: "submitLeaderReview",
  description: "Leader-only °C review with higher weight than peer reviews.",
  input: z.object({
    organizationId: z.string(),
    conversationId: z.string(),
    revieweeUserId: z.string(),
    temperatureRating: z.number().min(35).max(40),
    justification: z.string(),
    taskId: z.string().optional(),
  }),
  output: z.object({ reviewId: z.string().optional(), delta: z.number() }),
  async handler({ input }) {
    if (
      (user as any).state?.role !== "leader" &&
      (user as any).state?.role !== "admin"
    ) {
      throw new Error("submitLeaderReview is leader/admin-only");
    }
    const reviewerUserId = (user as any).id ?? "unknown";
    const occurredAt = new Date().toISOString();

    const created = await ReviewsTable.createRows({
      rows: [
        {
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          reviewerUserId,
          revieweeUserId: input.revieweeUserId,
          reviewType: "leader",
          temperatureRating: input.temperatureRating,
          justification: input.justification,
          taskId: input.taskId,
          periodStart: undefined,
          periodEnd: undefined,
          occurredAt,
        },
      ],
    });
    const reviewId = String((created as any)?.rows?.[0]?.id ?? "");

    const { rows: orgs } = await OrganizationsTable.findRows({
      filter: { id: input.organizationId } as any,
      limit: 1,
    });
    const leaderWeight = ((orgs as any[])[0]?.scoringWeights
      ?.leaderEvaluation ?? 0.1) as number;
    const delta = (input.temperatureRating - 36.5) * leaderWeight;

    await (actions as any).logTemperatureEvent({
      userId: input.revieweeUserId,
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      delta,
      reason:
        `leader review ${input.temperatureRating}°C: ${input.justification}`.slice(
          0,
          240,
        ),
      sourceType: "review",
      sourceId: reviewId || undefined,
      metricWeight: leaderWeight,
    });
    await (actions as any).logAudit({
      organizationId: input.organizationId,
      actorUserId: reviewerUserId,
      action: "leader.review",
      target: input.revieweeUserId,
      payload: {
        temperatureRating: input.temperatureRating,
        justification: input.justification,
      },
    });
    return { reviewId, delta };
  },
});
