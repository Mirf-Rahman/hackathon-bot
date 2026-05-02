import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GlassCard } from "../components/glass/GlassCard";
import { configureOrganization } from "../services/admin";
import { seedDemoData } from "../services/seed";

const DEFAULT_WEIGHTS = {
  responseTime: 0.2,
  participationVolume: 0.15,
  taskCompletion: 0.2,
  professionalism: 0.1,
  platformContribution: 0.15,
  leaderEvaluation: 0.1,
  peerEvaluation: 0.1,
};

export function AdminSettings({
  orgId,
  onOrgIdChange,
}: {
  orgId: string;
  onOrgIdChange?: (id: string) => void;
}) {
  const [weights, setWeights] =
    useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const [rules, setRules] = useState("");
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: () =>
      configureOrganization({
        organizationId: orgId,
        scoringWeights: weights,
        rules: rules || undefined,
      }),
  });

  const seed = useMutation({
    mutationFn: (reset: boolean) => seedDemoData(reset),
    onSuccess: (data) => {
      onOrgIdChange?.(data.organizationId);
      qc.invalidateQueries();
    },
  });

  return (
    <>
      <GlassCard title="Admin settings" footer={`Org ${orgId || "(none)"}`}>
        <p className="muted">
          These weights drive the *performance review label* (not the live
          temperature itself — that's the running cumulative log).
        </p>
      </GlassCard>

      <GlassCard
        title="Demo data"
        footer="Idempotent — re-running on the same org name is safe. Use Reset to start fresh."
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Seeds <strong>Acme Inc.</strong> with 3 group chats, 8 members, two
          weeks of temperature history, tasks, peer/leader reviews, a pending
          join request, and audit log entries.
        </p>
        <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
          <button
            className="btn btn-primary"
            disabled={seed.isPending}
            onClick={() => seed.mutate(false)}
          >
            {seed.isPending ? "Seeding…" : "Seed Acme Inc. demo"}
          </button>
          <button
            className="btn"
            disabled={seed.isPending}
            onClick={() => seed.mutate(true)}
          >
            Reset & re-seed
          </button>
          {seed.isSuccess && (
            <span className="muted">
              Created {seed.data.rowsCreated} rows · org id{" "}
              <code>{seed.data.organizationId}</code> · auto-applied to sidebar.
            </span>
          )}
          {seed.isError && (
            <span className="banner">Failed: {String(seed.error)}</span>
          )}
        </div>
      </GlassCard>

      {orgId && (
        <>
          <GlassCard title="Scoring weights">
            <div className="cluster">
              {Object.keys(weights).map((k) => (
                <label key={k} style={{ minWidth: 180 }}>
                  <div className="muted" style={{ marginBottom: 4 }}>
                    {k}
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    className="input"
                    value={weights[k]}
                    onChange={(e) =>
                      setWeights({ ...weights, [k]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              Sum:{" "}
              {Object.values(weights)
                .reduce((a, b) => a + b, 0)
                .toFixed(2)}{" "}
              — should be ≈ 1.0
            </div>
          </GlassCard>

          <GlassCard title="Custom org rules">
            <textarea
              className="textarea"
              rows={6}
              placeholder="Free-form policy text appended to the rules document shown during onboarding."
              value={rules}
              onChange={(e) => setRules(e.target.value)}
            />
          </GlassCard>

          <div className="row">
            <button
              className="btn btn-primary"
              onClick={() => m.mutate()}
              disabled={m.isPending}
            >
              {m.isPending ? "Saving…" : "Save changes"}
            </button>
            {m.isSuccess && <span className="muted">Saved.</span>}
            {m.isError && (
              <span className="banner">Failed: {String(m.error)}</span>
            )}
          </div>
        </>
      )}
    </>
  );
}
