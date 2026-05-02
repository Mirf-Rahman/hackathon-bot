import { useQuery } from "@tanstack/react-query";
import { fetchMemberProfile } from "../services/members";
import { GlassCard } from "../components/glass/GlassCard";
import { TempBadge } from "../components/temp/TempBadge";
import { TempTrendChart } from "../components/temp/TempTrendChart";

export function MemberProfile({
  userId,
  orgId,
}: {
  userId: string;
  orgId: string;
}) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["memberProfile", userId, orgId],
    queryFn: () => fetchMemberProfile(userId, orgId),
    refetchInterval: 15_000,
  });

  if (isPending) return <GlassCard title="Member">Loading…</GlassCard>;
  if (isError)
    return <GlassCard title="Member">Failed: {String(error)}</GlassCard>;

  return (
    <>
      <GlassCard
        title={`Member ${userId.slice(0, 16)}`}
        footer={`Current temperature: ${data.currentTemperature.toFixed(2)}°C`}
      >
        <div className="row">
          <TempBadge temperature={data.currentTemperature} />
          <span className="muted">
            {data.events.length} events · {data.tasks.length} tasks ·{" "}
            {data.reviews.length} reviews
          </span>
        </div>
      </GlassCard>

      <GlassCard title="Temperature trend">
        <TempTrendChart events={data.events} />
      </GlassCard>

      <GlassCard title="Why did the temperature change?">
        {data.events.length === 0 ? (
          <div className="muted">No events yet.</div>
        ) : (
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            {data.events
              .slice(-12)
              .reverse()
              .map((e, i) => (
                <li key={i} style={{ marginBottom: 6, fontSize: 14 }}>
                  <code>{new Date(e.occurredAt).toLocaleString()}</code> ·{" "}
                  <strong
                    style={{ color: e.delta >= 0 ? "#86efac" : "#fca5a5" }}
                  >
                    {e.delta >= 0 ? "+" : ""}
                    {e.delta.toFixed(2)}°C
                  </strong>{" "}
                  · {e.reason} <span className="muted">({e.sourceType})</span>
                </li>
              ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard title="Recent tasks">
        {data.tasks.length === 0 ? (
          <div className="muted">No tasks yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Due</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {data.tasks.slice(0, 10).map((t, i) => (
                <tr key={i}>
                  <td>{t.title}</td>
                  <td className="muted">{t.status}</td>
                  <td className="muted">
                    {t.dueAt ? new Date(t.dueAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="muted">
                    {t.completedOnTime === false
                      ? "late"
                      : t.completedOnTime
                        ? "on time"
                        : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>
    </>
  );
}
