import { Action, user, z } from "@botpress/runtime";
import { ContributionEvidenceTable } from "../tables/ContributionEvidence";

export const ingestEvidence = new Action({
  name: "ingestEvidence",
  description: "Attach a link as contribution evidence for a user.",
  input: z.object({
    organizationId: z.string(),
    conversationId: z.string(),
    userId: z.string().optional(),
    kind: z
      .enum(["github_commit", "manual_link", "doc", "placeholder"])
      .default("manual_link"),
    url: z.string().url(),
    title: z.string().optional(),
    notes: z.string().optional(),
  }),
  output: z.object({ ok: z.boolean(), evidenceId: z.string().optional() }),
  async handler({ input }) {
    const created = await ContributionEvidenceTable.createRows({
      rows: [
        {
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          userId: input.userId ?? (user as any).id ?? "unknown",
          kind: input.kind,
          url: input.url,
          title: input.title,
          notes: input.notes,
          occurredAt: new Date().toISOString(),
        },
      ],
    });
    const evidenceId = String((created as any)?.rows?.[0]?.id ?? "");
    return { ok: true, evidenceId };
  },
});
