import { Action, actions, user, z } from "@botpress/runtime";
import { ReviewsTable } from "../tables/Reviews";
import { OrganizationsTable } from "../tables/Organizations";

export const submitPeerReview = new Action({
  name: "submitPeerReview",
  description:
    "Record a peer °C review and adjust the reviewee's temperature by a weighted delta.",
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
    const reviewerUserId = (user as any).id ?? "unknown";
    const occurredAt = new Date().toISOString();

    const created = await ReviewsTable.createRows({
      rows: [
        {
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          reviewerUserId,
          revieweeUserId: input.revieweeUserId,
          reviewType: "peer",
          temperatureRating: input.temperatureRating,
          justification: input.justification,
          taskId: input.taskId,
          occurredAt,
        },
      ],
    });
    const reviewId = String((created as any)?.rows?.[0]?.id ?? "");

    const { rows: orgs } = await OrganizationsTable.findRows({
      filter: { id: input.organizationId } as any,
      limit: 1,
    });
    const peerWeight = ((orgs as any[])[0]?.scoringWeights?.peerEvaluation ??
      0.05) as number;
    const delta = (input.temperatureRating - 36.5) * peerWeight;

    await (actions as any).logTemperatureEvent({
      userId: input.revieweeUserId,
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      delta,
      reason:
        `peer review ${input.temperatureRating}°C: ${input.justification}`.slice(
          0,
          240,
        ),
      sourceType: "review",
      sourceId: reviewId || undefined,
      metricWeight: peerWeight,
    });
    await (actions as any).logActivity({
      event: "review.peer",
      who: input.revieweeUserId,
      what: `${input.temperatureRating}°C — ${input.justification}`,
      conversationId: input.conversationId,
    });
    return { reviewId, delta };
  },
});
