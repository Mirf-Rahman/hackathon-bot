import { Table, z } from "@botpress/runtime";

export const ContributionEvidenceTable = new Table({
  name: "ContributionEvidenceTable",
  description:
    "Link-level evidence of off-platform contribution (commits, docs, etc.).",
  columns: {
    organizationId: z.string(),
    conversationId: z.string(),
    userId: z.string(),
    kind: z.enum(["github_commit", "manual_link", "doc", "placeholder"]),
    url: z.string(),
    title: z.string().optional(),
    occurredAt: z.string(),
    notes: z.string().optional(),
  },
});
