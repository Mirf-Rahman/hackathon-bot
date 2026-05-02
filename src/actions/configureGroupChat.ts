import { Action, actions, user, z } from "@botpress/runtime";
import { GroupChatsTable } from "../tables/GroupChats";

export const configureGroupChat = new Action({
  name: "configureGroupChat",
  description:
    "Leader/admin: upsert per-GC settings. Partial — pass only fields you want to change.",
  input: z.object({
    conversationId: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    minTemperatureToJoin: z.number().optional(),
    joinGateEnabled: z.boolean().optional(),
    responseTimeSlaMin: z.number().optional(),
    maxRepliesPerHour: z.number().optional(),
    languageLevel: z.enum(["formal", "casual", "informal"]).optional(),
    audienceAgeBand: z.enum(["kids", "teen", "adult", "mixed"]).optional(),
    reviewSchedule: z
      .enum([
        "inherit",
        "weekly",
        "monthly",
        "quarterly",
        "semester",
        "yearly",
        "manual",
      ])
      .optional(),
    links: z
      .object({
        github: z.string().optional(),
        googleDoc: z.string().optional(),
        googleSheet: z.string().optional(),
        figma: z.string().optional(),
        notion: z.string().optional(),
        jira: z.string().optional(),
        ppt: z.string().optional(),
      })
      .optional(),
  }),
  output: z.object({ ok: z.boolean() }),
  async handler({ input }) {
    if (
      (user as any).state?.role !== "leader" &&
      (user as any).state?.role !== "admin"
    ) {
      throw new Error("configureGroupChat is leader/admin-only");
    }
    const { rows } = await GroupChatsTable.findRows({
      filter: { conversationId: input.conversationId } as any,
      limit: 1,
    });
    const existing = (rows as any[])[0];
    if (!existing)
      throw new Error(`Group chat ${input.conversationId} not found`);

    const merged = {
      id: existing.id,
      ...existing,
      ...input,
      links: { ...(existing.links ?? {}), ...(input.links ?? {}) },
    };
    await GroupChatsTable.updateRows({ rows: [merged as any] });
    await (actions as any).logAudit({
      organizationId: existing.organizationId,
      actorUserId: (user as any).id ?? "unknown",
      action: "gc.configure",
      target: input.conversationId,
      payload: input,
    });
    return { ok: true };
  },
});
