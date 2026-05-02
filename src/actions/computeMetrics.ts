import { Action, z } from "@botpress/runtime";
import { MessagesTable } from "../tables/Messages";
import { TasksTable } from "../tables/Tasks";
import { ReviewsTable } from "../tables/Reviews";
import { TemperatureEventsTable } from "../tables/TemperatureEvents";
import { ContributionEvidenceTable } from "../tables/ContributionEvidence";
import { DEFAULT_WEIGHTS } from "../lib/temperature";

/**
 * Pure derivation of normalized metric scores for a (user, conversation, period).
 * Inputs are read from the bot's tables; outputs are deterministic numbers in
 * [0..1]. Temperature itself is the running cumulative sum of TemperatureEvents,
 * not a weighted blob — this metric bundle drives the *performance review label*.
 */
export const computeMetrics = new Action({
  name: "computeMetrics",
  description: "Compute normalized scoring metrics for a user over a period.",
  input: z.object({
    userId: z.string(),
    conversationId: z.string().optional(),
    organizationId: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    weights: z.record(z.number()).optional(),
  }),
  output: z.object({
    metrics: z.record(
      z.object({
        raw: z.number(),
        normalized: z.number(),
        weight: z.number(),
        explanation: z.string(),
      }),
    ),
    score: z.number(),
  }),
  async handler({ input }) {
    const weights = { ...DEFAULT_WEIGHTS, ...(input.weights ?? {}) } as Record<
      string,
      number
    >;
    const periodStart = new Date(input.periodStart).getTime();
    const periodEnd = new Date(input.periodEnd).getTime();

    const inPeriod = (iso: string | undefined) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= periodStart && t <= periodEnd;
    };

    // ── Read bounded slices (MVP: read up to N rows; not paginated)
    const [
      { rows: msgs },
      { rows: tasks },
      { rows: reviews },
      { rows: events },
      { rows: evidence },
    ] = await Promise.all([
      MessagesTable.findRows({
        filter: { senderUserId: input.userId } as any,
        limit: 1000,
      }),
      TasksTable.findRows({
        filter: { assigneeUserId: input.userId } as any,
        limit: 500,
      }),
      ReviewsTable.findRows({
        filter: { revieweeUserId: input.userId } as any,
        limit: 500,
      }),
      TemperatureEventsTable.findRows({
        filter: { userId: input.userId } as any,
        limit: 1000,
      }),
      ContributionEvidenceTable.findRows({
        filter: { userId: input.userId } as any,
        limit: 500,
      }),
    ]);

    const periodMsgs = (msgs as any[]).filter((m) => inPeriod(m.postedAt));
    const periodTasks = (tasks as any[]).filter((t) =>
      inPeriod(t.completedAt ?? t.dueAt),
    );
    const periodReviews = (reviews as any[]).filter((r) =>
      inPeriod(r.occurredAt),
    );
    const periodEvents = (events as any[]).filter((e) =>
      inPeriod(e.occurredAt),
    );
    const periodEvidence = (evidence as any[]).filter((e) =>
      inPeriod(e.occurredAt),
    );

    // ── Response time
    const respMs = periodMsgs
      .map((m) => Number(m.responseToMs))
      .filter((n) => Number.isFinite(n) && n > 0);
    const avgRespMin = respMs.length
      ? respMs.reduce((a, b) => a + b, 0) / respMs.length / 60_000
      : 0;
    const respNorm =
      respMs.length === 0 ? 0.5 : Math.max(0, Math.min(1, 1 - avgRespMin / 60));

    // ── Participation volume
    const meaningful = periodMsgs.filter((m) => m.meaningful).length;
    const partRaw = meaningful;
    const partNorm = Math.max(0, Math.min(1, partRaw / 50));

    // ── Task completion
    const done = periodTasks.filter((t) => t.status === "done").length;
    const onTime = periodTasks.filter((t) => t.completedOnTime === true).length;
    const totalTasks = periodTasks.length || 0;
    const completionNorm =
      totalTasks === 0 ? 0.5 : Math.max(0, Math.min(1, done / totalTasks));
    const onTimeRatio = done === 0 ? 0 : onTime / done;

    // ── Professionalism
    const profCounts: Record<string, number> = {};
    for (const m of periodMsgs) {
      const k = String(m.professionalism ?? "neutral");
      profCounts[k] = (profCounts[k] ?? 0) + 1;
    }
    const totalLabeled = periodMsgs.filter((m) => m.professionalism).length;
    const profPositive = profCounts["professional"] ?? 0;
    const profNegative =
      (profCounts["unprofessional"] ?? 0) + (profCounts["risky"] ?? 0) * 2;
    const profNorm =
      totalLabeled === 0
        ? 0.6
        : Math.max(
            0,
            Math.min(
              1,
              0.5 +
                (profPositive - profNegative) / Math.max(totalLabeled, 1) / 2,
            ),
          );

    // ── Platform contribution
    const commits = periodEvidence.filter(
      (e) => e.kind === "github_commit",
    ).length;
    const platformNorm = Math.max(
      0,
      Math.min(1, (commits + periodEvidence.length * 0.2) / 20),
    );

    // ── Reviews
    const peerRatings = periodReviews
      .filter((r) => r.reviewType === "peer")
      .map((r) => Number(r.temperatureRating))
      .filter((n) => Number.isFinite(n));
    const leaderRatings = periodReviews
      .filter((r) => r.reviewType === "leader")
      .map((r) => Number(r.temperatureRating))
      .filter((n) => Number.isFinite(n));
    const avg = (xs: number[]) =>
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 36.5;
    const peerNorm = Math.max(0, Math.min(1, (avg(peerRatings) - 35) / 5));
    const leaderNorm = Math.max(0, Math.min(1, (avg(leaderRatings) - 35) / 5));

    const metrics = {
      responseTime: {
        raw: avgRespMin,
        normalized: respNorm,
        weight: weights.responseTime ?? 0,
        explanation: respMs.length
          ? `Avg response time ${avgRespMin.toFixed(1)} min over ${respMs.length} messages.`
          : "No response-time samples this period.",
      },
      participationVolume: {
        raw: partRaw,
        normalized: partNorm,
        weight: weights.participationVolume ?? 0,
        explanation: `${meaningful} meaningful messages.`,
      },
      taskCompletion: {
        raw: done,
        normalized: completionNorm,
        weight: weights.taskCompletion ?? 0,
        explanation: `${done}/${totalTasks} tasks complete (${Math.round(onTimeRatio * 100)}% on time).`,
      },
      professionalism: {
        raw: profPositive - profNegative,
        normalized: profNorm,
        weight: weights.professionalism ?? 0,
        explanation: totalLabeled
          ? `${profPositive} professional vs ${profNegative} unprofessional/risky over ${totalLabeled} labeled messages.`
          : "No labeled messages in period.",
      },
      platformContribution: {
        raw: commits,
        normalized: platformNorm,
        weight: weights.platformContribution ?? 0,
        explanation: `${commits} GitHub commits + ${periodEvidence.length - commits} other evidence rows.`,
      },
      leaderEvaluation: {
        raw: avg(leaderRatings),
        normalized: leaderNorm,
        weight: weights.leaderEvaluation ?? 0,
        explanation: leaderRatings.length
          ? `Avg leader rating ${avg(leaderRatings).toFixed(1)}°C across ${leaderRatings.length} reviews.`
          : "No leader reviews this period.",
      },
      peerEvaluation: {
        raw: avg(peerRatings),
        normalized: peerNorm,
        weight: weights.peerEvaluation ?? 0,
        explanation: peerRatings.length
          ? `Avg peer rating ${avg(peerRatings).toFixed(1)}°C across ${peerRatings.length} reviews.`
          : "No peer reviews this period.",
      },
    };

    const score = Object.values(metrics).reduce(
      (acc, m) => acc + m.normalized * m.weight,
      0,
    );

    void periodEvents; // currently unused; kept for future drift analysis
    return { metrics, score: Math.max(0, Math.min(1, score)) };
  },
});
