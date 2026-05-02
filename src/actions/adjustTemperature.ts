import { Action, actions, user, z } from "@botpress/runtime";

/**
 * Manual leader override — always requires a written justification and
 * always writes both a TemperatureEvent (sourceType='manual') and an
 * AuditLog row.
 */
export const adjustTemperature = new Action({
  name: "adjustTemperature",
  description:
    "Leader/admin manual temperature override with required justification.",
  input: z.object({
    organizationId: z.string(),
    conversationId: z.string().optional(),
    targetUserId: z.string(),
    delta: z.number(),
    justification: z
      .string()
      .min(8, "Justification is required and must be substantive"),
  }),
  output: z.object({
    ok: z.boolean(),
    beforeValue: z.number(),
    afterValue: z.number(),
  }),
  async handler({ input }) {
    if (
      (user as any).state?.role !== "leader" &&
      (user as any).state?.role !== "admin"
    ) {
      throw new Error("adjustTemperature is leader/admin-only");
    }
    const actorUserId = (user as any).id ?? "unknown";

    const result = await (actions as any).logTemperatureEvent({
      userId: input.targetUserId,
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      delta: input.delta,
      reason: `manual adjust by leader: ${input.justification}`.slice(0, 240),
      sourceType: "manual",
      bypassCap: false,
    });
    await (actions as any).logAudit({
      organizationId: input.organizationId,
      actorUserId,
      action: "temperature.adjust",
      target: input.targetUserId,
      payload: { delta: input.delta, justification: input.justification },
    });
    return {
      ok: true,
      beforeValue: result.beforeValue,
      afterValue: result.afterValue,
    };
  },
});
