import { Table, z } from "@botpress/runtime";

/**
 * Auditable consent. Append-only in practice — never delete a consent row.
 * Tracking does not begin until a row exists for (userId, organizationId).
 */
export const ConsentRecordsTable = new Table({
  name: "ConsentRecordsTable",
  description:
    "Per-user consent to be tracked under an organization rules version.",
  columns: {
    organizationId: z.string(),
    userId: z.string(),
    conversationId: z.string().optional(),
    acceptedAt: z.string(),
    rulesVersion: z.string().default("1.0"),
    rulesSnapshot: z
      .string()
      .describe("Markdown of what the user actually saw"),
    channel: z.string().optional(),
  },
});
