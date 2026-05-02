import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { GlassCard } from "../components/glass/GlassCard";
import { generateReport } from "../services/reviews";

export function ReviewCenter({ orgId }: { orgId: string }) {
  const [userId, setUserId] = useState("");
  const [period, setPeriod] = useState<
    "weekly" | "monthly" | "quarterly" | "custom"
  >("monthly");
  const [start, setStart] = useState(() =>
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const m = useMutation({
    mutationFn: () =>
      generateReport({
        organizationId: orgId,
        userId,
        period,
        periodStart: new Date(start).toISOString(),
        periodEnd: new Date(end).toISOString(),
      }),
  });

  return (
    <>
      <GlassCard title="Performance Review Center" footer={`Org ${orgId}`}>
        <p className="muted">
          Generate a structured performance review for any member. Reports are
          stored in
          <code> PerformanceReportsTable</code> and labeled outstanding / strong
          / stable / at_risk / critical.
        </p>
      </GlassCard>

      <GlassCard title="Generate a report">
        <div className="cluster" style={{ marginBottom: 12 }}>
          <input
            className="input"
            style={{ flex: 2, minWidth: 220 }}
            placeholder="User ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <select
            className="select"
            style={{ flex: 1, minWidth: 140 }}
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
          >
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
            <option value="quarterly">quarterly</option>
            <option value="custom">custom</option>
          </select>
          <input
            className="input"
            style={{ flex: 1, minWidth: 130 }}
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <input
            className="input"
            style={{ flex: 1, minWidth: 130 }}
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={!userId || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "Generating…" : "Generate"}
          </button>
        </div>

        {m.isError && <div className="banner">Failed: {String(m.error)}</div>}

        {m.data && (
          <div className="glass" style={{ padding: 16, marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{m.data.label.toUpperCase()}</strong>
              <span className="muted">
                Score {(m.data.score * 100).toFixed(0)} / 100
              </span>
            </div>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                fontSize: 14,
                marginTop: 12,
              }}
            >
              {m.data.markdown}
            </pre>
          </div>
        )}
      </GlassCard>
    </>
  );
}
