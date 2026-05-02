import { Table, z } from "@botpress/runtime";

export const ReviewsTable = new Table({
  name: "ReviewsTable",
  description:
    "Peer & leader reviews — temperature-based ratings, not 1-5 stars.",
  columns: {
    conversationId: z.string(),
    organizationId: z.string(),
    reviewerUserId: z.string(),
    revieweeUserId: z.string(),
    reviewType: z.enum(["peer", "leader"]).default("peer"),
    temperatureRating: z
      .number()
      .describe("e.g. 38.4 — what the reviewer thinks the reviewee feels like"),
    justification: { searchable: true, schema: z.string() },
    taskId: z.string().optional(),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    occurredAt: z.string(),
  },
});
