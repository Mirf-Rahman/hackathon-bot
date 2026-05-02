import { Action, actions, configuration, z } from "@botpress/runtime";

/**
 * Append an event row to a Google Sheet (or skip silently when no sheet
 * is configured). Demo wow-factor — not the source of truth.
 */
export const logActivity = new Action({
  name: "logActivity",
  description: "Append a row to the configured Google Sheet activity log.",
  input: z.object({
    event: z.string(),
    who: z.string(),
    what: z.string(),
    conversationId: z.string(),
    url: z.string().optional(),
    sheetId: z.string().optional(),
  }),
  output: z.object({ ok: z.boolean(), skipped: z.boolean().optional() }),
  async handler({ input }) {
    const spreadsheetId =
      input.sheetId ?? (configuration as any)?.defaultSheetId;
    if (!spreadsheetId) {
      return { ok: true, skipped: true };
    }
    const range = (configuration as any)?.defaultSheetRange ?? "Activity!A:F";
    try {
      await (actions as any).gsheets.appendValues({
        spreadsheetId,
        range,
        values: [
          [
            new Date().toISOString(),
            input.event,
            input.who,
            input.what,
            input.conversationId,
            input.url ?? "",
          ],
        ],
      });
      return { ok: true };
    } catch (err) {
      // Don't break the chat just because the sheet integration is misconfigured.
      console.warn("[logActivity] gsheets.appendValues failed:", err);
      return { ok: false, skipped: true };
    }
  },
});
