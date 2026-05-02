import { Action, z } from "@botpress/runtime";
import { MessagesTable } from "../tables/Messages";

/**
 * Read-model for the GC group-chat feed: returns the last N messages for a
 * conversation (group chat) ordered oldest → newest, ready for bubble render.
 */
export const listGcMessages = new Action({
  name: "listGcMessages",
  description:
    "List recent messages for a group chat (with author display name + tone) for the UI feed.",
  input: z.object({
    conversationId: z.string(),
    limit: z.number().int().min(1).max(200).default(100),
  }),
  output: z.object({
    messages: z.array(
      z.object({
        id: z.string(),
        senderUserId: z.string(),
        senderDisplayName: z.string().optional(),
        text: z.string().optional(),
        postedAt: z.string(),
        professionalism: z.string().optional(),
      }),
    ),
  }),
  async handler({ input }) {
    const { rows } = await MessagesTable.findRows({
      filter: { conversationId: input.conversationId } as any,
      limit: input.limit,
    });
    const sorted = (rows as any[])
      .slice()
      .sort(
        (a, b) =>
          new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime(),
      );
    return {
      messages: sorted.map((r) => ({
        id: String(r.id ?? r.rowId ?? r.postedAt),
        senderUserId: r.senderUserId,
        senderDisplayName: r.senderDisplayName,
        text: r.text,
        postedAt: r.postedAt,
        professionalism: r.professionalism,
      })),
    };
  },
});
