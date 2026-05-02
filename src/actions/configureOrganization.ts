import { Action, actions, user, z } from "@botpress/runtime";
import { OrganizationsTable } from "../tables/Organizations";

export const configureOrganization = new Action({
  name: "configureOrganization",
  description:
    "Admin: upsert org-level scoring weights, thresholds, review cadence, and rules.",
  input: z.object({
    organizationId: z.string(),
    name: z.string().optional(),
    scoringWeights: z.record(z.number()).optional(),
    performanceThresholds: z.record(z.number()).optional(),
    reviewSchedule: z
      .enum(["weekly", "monthly", "quarterly", "semester", "yearly", "manual"])
      .optional(),
    reviewAnchorDate: z.string().optional(),
    rules: z.string().optional(),
    rulesVersion: z.string().optional(),
  }),
  output: z.object({ ok: z.boolean() }),
  async handler({ input }) {
    if ((user as any).state?.role !== "admin") {
      throw new Error("configureOrganization is admin-only");
    }
    const id = Number(input.organizationId);
    const existing = await OrganizationsTable.getRow({ id } as any);
    if (!existing)
      throw new Error(`Organization ${input.organizationId} not found`);

    const merged = {
      ...existing,
      id,
      ...input,
      scoringWeights: {
        ...(existing.scoringWeights ?? {}),
        ...(input.scoringWeights ?? {}),
      },
      performanceThresholds: {
        ...(existing.performanceThresholds ?? {}),
        ...(input.performanceThresholds ?? {}),
      },
    };
    await OrganizationsTable.updateRows({ rows: [merged as any] });
    await (actions as any).logAudit({
      organizationId: input.organizationId,
      actorUserId: (user as any).id ?? "unknown",
      action: "org.configure",
      target: input.organizationId,
      payload: input,
    });
    return { ok: true };
  },
});
