import { Table, z } from "@botpress/runtime";

/**
 * The trend chart's source of truth. Every Δ to a user's temperature MUST
 * write a row here via the `logTemperatureEvent` action.
 */
export const TemperatureEventsTable = new Table({
  name: "TemperatureEventsTable",
  description:
    "Append-only log of every temperature change with reason + source metric.",
  columns: {
    userId: z.string(),
    conversationId: z.string().optional(),
    organizationId: z.string(),
    delta: z.number(),
    beforeValue: z.number(),
    afterValue: z.number(),
    reason: { searchable: true, schema: z.string() },
    sourceType: z.enum([
      "task",
      "review",
      "commit",
      "manual",
      "decay",
      "language",
      "streak",
    ]),
    sourceId: z.string().optional(),
    metricWeight: z.number().optional(),
    occurredAt: z.string(),
  },
});
