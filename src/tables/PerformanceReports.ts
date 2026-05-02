import { Table, z } from "@botpress/runtime";

export const PerformanceReportsTable = new Table({
  name: "PerformanceReportsTable",
  description:
    "Generated period reviews (Markdown + structured metrics + label).",
  columns: {
    organizationId: z.string(),
    conversationId: z.string().optional(),
    userId: z.string(),
    period: z.enum([
      "weekly",
      "monthly",
      "quarterly",
      "semester",
      "yearly",
      "custom",
    ]),
    periodStart: z.string(),
    periodEnd: z.string(),
    startTemperature: z.number(),
    endTemperature: z.number(),
    label: z.enum(["outstanding", "strong", "stable", "at_risk", "critical"]),
    score: z.number().describe("Weighted aggregate 0..1"),
    metrics: z.record(z.any()).default({}),
    markdown: { searchable: true, schema: z.string() },
    generatedAt: z.string(),
  },
});
