import { Action, actions, adk, z } from "@botpress/runtime";
import { OrganizationsTable } from "../tables/Organizations";
import { TemperatureEventsTable } from "../tables/TemperatureEvents";
import { PerformanceReportsTable } from "../tables/PerformanceReports";
import { labelFromScore } from "../lib/temperature";

export const generatePerformanceReport = new Action({
  name: "generatePerformanceReport",
  description:
    "Generate a structured Markdown performance review for a user over a period.",
  input: z.object({
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
  }),
  output: z.object({
    label: z.enum(["outstanding", "strong", "stable", "at_risk", "critical"]),
    score: z.number(),
    markdown: z.string(),
    reportId: z.string().optional(),
  }),
  async handler({ input }) {
    const { rows: orgs } = await OrganizationsTable.findRows({
      filter: { id: input.organizationId } as any,
      limit: 1,
    });
    const org = (orgs as any[])[0] ?? {};

    const { metrics, score } = await (actions as any).computeMetrics({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      userId: input.userId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      weights: org.scoringWeights ?? undefined,
    });

    const label = labelFromScore(score, org.performanceThresholds ?? {});

    // Temperature endpoints over the period
    const { rows: events } = await TemperatureEventsTable.findRows({
      filter: {
        userId: input.userId,
        organizationId: input.organizationId,
      } as any,
      limit: 1000,
    });
    const periodEvents = (events as any[]).filter((e) => {
      const t = new Date(e.occurredAt).getTime();
      return (
        t >= new Date(input.periodStart).getTime() &&
        t <= new Date(input.periodEnd).getTime()
      );
    });
    const startTemperature = periodEvents[0]?.beforeValue ?? 36.5;
    const endTemperature =
      periodEvents[periodEvents.length - 1]?.afterValue ?? startTemperature;

    // Build a structured Markdown
    const lines: string[] = [];
    lines.push(`# Performance Review`);
    lines.push(`**User:** ${input.userId}`);
    lines.push(
      `**Period:** ${input.period} (${input.periodStart} → ${input.periodEnd})`,
    );
    lines.push(
      `**Label:** **${label.toUpperCase()}**  \u00b7  Score ${(score * 100).toFixed(0)} / 100`,
    );
    lines.push(
      `**Temperature:** ${startTemperature.toFixed(1)}°C → ${endTemperature.toFixed(1)}°C`,
    );
    lines.push("");
    lines.push("## Metrics");
    for (const [name, m] of Object.entries(metrics) as Array<[string, any]>) {
      lines.push(
        `- **${name}** — score ${(m.normalized * 100).toFixed(0)}% (weight ${(m.weight * 100).toFixed(0)}%): ${m.explanation}`,
      );
    }

    let prose = "";
    try {
      prose = await (adk as any).zai.summarize(lines.join("\n"), {
        prompt:
          "Write a neutral, evidence-cited performance review summary in 4-6 sentences. " +
          "Cite metrics and concrete events only — no insults, no speculative character judgment, no stereotypes.",
        length: 350,
      });
    } catch {
      prose = "";
    }
    if (prose) {
      lines.push("");
      lines.push("## Summary");
      lines.push(prose);
    }

    const markdown = lines.join("\n");

    const created = await PerformanceReportsTable.createRows({
      rows: [
        {
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          userId: input.userId,
          period: input.period,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          startTemperature,
          endTemperature,
          label,
          score,
          metrics,
          markdown,
          generatedAt: new Date().toISOString(),
        },
      ],
    });
    const reportId = String((created as any)?.rows?.[0]?.id ?? "");

    return { label, score, markdown, reportId };
  },
});
