import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { GlassCard } from "../components/glass/GlassCard";
import { TempBadge } from "../components/temp/TempBadge";
import { DualTrendChart } from "../components/temp/DualTrendChart";
import { fetchMemberProfile } from "../services/members";
import { DEMO_TEAM, resolveDisplayName } from "../lib/demoTeam";

const SERIES_COLORS = ["#60a5fa", "#f472b6"];

export function Compare({ orgId }: { orgId: string }) {
  const [a, setA] = useState(DEMO_TEAM[1]?.userId ?? "");
  const [b, setB] = useState(DEMO_TEAM[2]?.userId ?? "");

  const queries = useQueries({
    queries: [a, b].map((uid) => ({
      queryKey: ["memberProfile", uid, orgId],
      queryFn: () => fetchMemberProfile(uid, orgId),
      enabled: !!uid && !!orgId,
      refetchInterval: 8_000,
    })),
  });

  const [pa, pb] = queries;
  const ready = pa.data && pb.data;

  return (
    <>
      <GlassCard
        title="Side-by-side comparison"
        footer={`Org ${orgId}`}
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Pick two teammates to overlay their temperature trends, compare task
          throughput, and spot gaps. Updates live as new events arrive.
        </p>
        <div className="cluster" style={{ marginTop: 12 }}>
          <label style={{ flex: 1, minWidth: 220 }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: SERIES_COLORS[0],
                  marginRight: 6,
                  verticalAlign: "middle",
                }}
              />
              Member A
            </div>
            <select
              className="select"
              value={a}
              onChange={(e) => setA(e.target.value)}
            >
              {DEMO_TEAM.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.displayName} — {p.workRole}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 220 }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: SERIES_COLORS[1],
                  marginRight: 6,
                  verticalAlign: "middle",
                }}
              />
              Member B
            </div>
            <select
              className="select"
              value={b}
              onChange={(e) => setB(e.target.value)}
            >
              {DEMO_TEAM.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.displayName} — {p.workRole}
                </option>
              ))}
            </select>
          </label>
        </div>
      </GlassCard>

      <GlassCard title="Temperature trend">
        {pa.isPending || pb.isPending ? (
          <div className="muted">Loading…</div>
        ) : pa.isError || pb.isError ? (
          <div className="banner">
            Failed: {String(pa.error ?? pb.error)}
          </div>
        ) : (
          <DualTrendChart
            series={[
              { userId: a, events: pa.data!.events },
              { userId: b, events: pb.data!.events },
            ]}
          />
        )}
      </GlassCard>

      {ready && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          {[
            { uid: a, profile: pa.data!, color: SERIES_COLORS[0] },
            { uid: b, profile: pb.data!, color: SERIES_COLORS[1] },
          ].map(({ uid, profile, color }) => {
            const tasks = profile.tasks;
            const done = tasks.filter((t) => t.status === "done").length;
            const onTime = tasks.filter((t) => t.completedOnTime === true).length;
            const open = tasks.filter((t) => t.status === "open").length;
            const reviewsReceived = profile.reviews.length;
            const avgReview =
              reviewsReceived === 0
                ? null
                : profile.reviews.reduce(
                    (acc, r) => acc + (r.temperatureRating ?? 0),
                    0,
                  ) / reviewsReceived;
            return (
              <GlassCard
                key={uid}
                title={resolveDisplayName(uid)}
                footer={
                  <span style={{ color, fontWeight: 600 }}>
                    {color === SERIES_COLORS[0] ? "Member A" : "Member B"}
                  </span>
                }
              >
                <div className="row" style={{ marginBottom: 12 }}>
                  <TempBadge temperature={profile.currentTemperature} />
                </div>
                <table>
                  <tbody>
                    <CompareRow label="Tasks total" value={tasks.length} />
                    <CompareRow label="Tasks done" value={done} />
                    <CompareRow label="On-time completion" value={`${onTime}/${done || 1}`} />
                    <CompareRow label="Tasks open" value={open} />
                    <CompareRow
                      label="Reviews received"
                      value={reviewsReceived}
                    />
                    <CompareRow
                      label="Avg review rating"
                      value={avgReview === null ? "—" : `${avgReview.toFixed(2)}°C`}
                    />
                    <CompareRow
                      label="Temp events"
                      value={profile.events.length}
                    />
                  </tbody>
                </table>
              </GlassCard>
            );
          })}
        </div>
      )}
    </>
  );
}

function CompareRow({ label, value }: { label: string; value: string | number }) {
  return (
    <tr>
      <td className="muted" style={{ width: "60%" }}>
        {label}
      </td>
      <td style={{ textAlign: "right", fontWeight: 600 }}>{value}</td>
    </tr>
  );
}
