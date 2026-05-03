import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { GlassCard } from "../components/glass/GlassCard";
import { generateReport } from "../services/reviews";
import { DEMO_TEAM, resolveDisplayName } from "../lib/demoTeam";
import { openReportPrintWindow, reportToPreviewHtml } from "../lib/pdf";

export function ReviewCenter({ orgId }: { orgId: string }) {
  const [userId, setUserId] = useState<string>(DEMO_TEAM[1]?.userId ?? "");
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

  const displayName = resolveDisplayName(userId);
  const previewHtml = m.data ? reportToPreviewHtml(m.data.markdown) : "";

  function downloadPdf() {
    if (!m.data) return;
    openReportPrintWindow({
      markdown: m.data.markdown,
      label: m.data.label,
      score: m.data.score,
      userId,
      displayName,
      period,
      periodStart: new Date(start).toISOString(),
      periodEnd: new Date(end).toISOString(),
      organizationId: orgId,
    });
  }

  return (
    <>
      <GlassCard title="Performance Review Center" footer={`Org ${orgId}`}>
        <p className="muted">
          Generate a structured performance review for any member. Reports are
          stored in <code>PerformanceReportsTable</code> and labeled
          outstanding / strong / stable / at_risk / critical. Download as a
          print-ready PDF for sharing.
        </p>
      </GlassCard>

      <GlassCard title="Generate a report">
        <div className="cluster" style={{ marginBottom: 12 }}>
          <label style={{ flex: 2, minWidth: 220 }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
              Member
            </div>
            <select
              className="select"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              {DEMO_TEAM.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.displayName} — {p.workRole}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 140 }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
              Period
            </div>
            <select
              className="select"
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
            >
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="quarterly">quarterly</option>
              <option value="custom">custom</option>
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 130 }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
              From
            </div>
            <input
              className="input"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label style={{ flex: 1, minWidth: 130 }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
              To
            </div>
            <input
              className="input"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <button
            className="btn btn-primary"
            disabled={!userId || m.isPending}
            onClick={() => m.mutate()}
            style={{ alignSelf: "flex-end" }}
          >
            {m.isPending ? "Generating…" : "Generate"}
          </button>
        </div>

        {m.isError && <div className="banner">Failed: {String(m.error)}</div>}

        {m.data && (
          <div className="report-preview">
            <div className="report-preview-toolbar">
              <span className={`report-pill report-pill--${m.data.label}`}>
                {m.data.label.replace("_", " ").toUpperCase()} · Score{" "}
                {(m.data.score * 100).toFixed(0)} / 100
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                {displayName} · {period} · {start} → {end}
              </span>
              <div style={{ flex: 1 }} />
              <button
                className="btn"
                onClick={() => navigator.clipboard.writeText(m.data!.markdown)}
                title="Copy raw markdown to the clipboard"
              >
                Copy markdown
              </button>
              <button
                className="btn btn-primary"
                onClick={downloadPdf}
                title="Open a print-ready window — pick 'Save as PDF' in the print dialog"
              >
                Download PDF
              </button>
            </div>
            <article
              className="report-body"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        )}
      </GlassCard>
    </>
  );
}
