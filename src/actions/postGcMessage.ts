import { Action, actions, z } from "@botpress/runtime";
import { MessagesTable } from "../tables/Messages";

/**
 * Append a message to a group-chat feed from the UI. Best-effort tone scoring
 * via the bot's `scoreLanguage` action so the message renders with proper
 * coloring + tracks meaningfulness right away.
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

    let professionalism: string | undefined;
    let meaningful: boolean | undefined;
    try {
      const lang = (await (actions as any).scoreLanguage({
        text: input.text,
      })) as { label?: string; meaningful?: boolean };
      professionalism = lang?.label;
      meaningful = lang?.meaningful;
    } catch {
      // ignore — keep undefined
    }

    await MessagesTable.createRows({
      rows: [
        {
          conversationId: input.conversationId,
          organizationId: input.organizationId,
          senderUserId: input.senderUserId,
          senderDisplayName: input.senderDisplayName ?? "You",
          text: input.text,
          postedAt,
          professionalism: professionalism as any,
          meaningful,
          responseToMs: undefined,
        },
      ],
    });
    return { ok: true, postedAt };
  },
});
