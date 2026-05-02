import { Table, z } from "@botpress/runtime";

export const OrganizationsTable = new Table({
  name: "OrganizationsTable",
  description:
    "Top-level tenant. Owns group chats, scoring weights, and integration creds.",
  columns: {
    name: {
      searchable: true,
      schema: z.string().describe("Organization name"),
    },
    ownerUserId: z.string(),
    scoringWeights: z
      .record(z.number())
      .default({})
      .describe(
        "Override default metric weights per metric name (responseTime, peerEvaluation, ...)",
      ),
    performanceThresholds: z
      .record(z.number())
      .default({})
      .describe("Override label thresholds: outstanding/strong/stable/at_risk"),
    reviewSchedule: z
      .enum(["weekly", "monthly", "quarterly", "semester", "yearly", "manual"])
      .default("monthly"),
    reviewAnchorDate: z.string().optional(),
    rules: z
      .string()
      .optional()
      .describe("Free-form policy text shown in the rules document"),
    rulesVersion: z.string().default("1.0"),
  },
});
