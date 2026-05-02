import { Table, z } from "@botpress/runtime";

/**
 * Lightweight per-message metric record. We do NOT store full content here —
 * webchat already keeps history. This row exists to compute response-time,
 * participation volume, and language professionalism scores.
 */
export const MessagesTable = new Table({
  name: "MessagesTable",
  description: "Per-message metric record (timestamps + zai labels).",
  columns: {
    conversationId: z.string(),
    organizationId: z.string().optional(),
    senderUserId: z.string(),
    senderDisplayName: z.string().optional(),
    text: z
      .string()
      .optional()
      .describe("Message content (for group chat feed render)"),
    postedAt: z.string().describe("ISO 8601 timestamp"),
    professionalism: z
      .enum(["professional", "neutral", "informal", "unprofessional", "risky"])
      .optional(),
    meaningful: z
      .boolean()
      .optional()
      .describe("zai-judged: substantive vs ack/emoji"),
    responseToMs: z
      .number()
      .optional()
      .describe("ms since previous message in chat"),
  },
});
