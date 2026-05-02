import { Action, z } from "@botpress/runtime";
import { MessagesTable } from "../tables/Messages";

/**
 * Append a message to a group-chat feed from the UI (the "you" persona).
 * Tone is left undefined — the bot's existing scoreLanguage flow can fill it
 * later if needed. Used by the React GroupChatFeed input box.
 */
export const postGcMessage = new Action({
  name: "postGcMessage",
  description:
    "Append a message authored by the current UI user to a group chat feed.",
  input: z.object({
    conversationId: z.string(),
    organizationId: z.string().optional(),
    senderUserId: z.string(),
    senderDisplayName: z.string().optional(),
    text: z.string().min(1).max(4000),
  }),
  output: z.object({ ok: z.boolean(), postedAt: z.string() }),
  async handler({ input }) {
    const postedAt = new Date().toISOString();
    await MessagesTable.createRows({
      rows: [
        {
          conversationId: input.conversationId,
          organizationId: input.organizationId,
          senderUserId: input.senderUserId,
          senderDisplayName: input.senderDisplayName ?? "You",
          text: input.text,
          postedAt,
        },
      ],
    });
    return { ok: true, postedAt };
  },
});
