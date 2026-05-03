import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchLeaderboard, fetchOrgDashboard } from "../services/dashboard";
import { GlassCard } from "../components/glass/GlassCard";
import { TempBadge } from "../components/temp/TempBadge";
import { resolveDisplayName } from "../lib/demoTeam";

export function OrgDashboard({
  orgId,
  onOpenGc,
}: {
  orgId: string;
  onOpenGc: (gcId: string) => void;
}) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["orgDashboard", orgId],
    queryFn: () => fetchOrgDashboard(orgId),
    refetchInterval: 8_000,
  });

  // Live average temperature per GC. The seeded `currentAvgTemperature` is a
  // snapshot from when the GC was created — recomputing here keeps the
  // dashboard in sync with the leaderboard / chat activity.
  const gcIds = data?.groupChats.map((gc) => gc.conversationId) ?? [];
  const leaderboards = useQueries({
    queries: gcIds.map((id) => ({
      queryKey: ["leaderboard", id],
      queryFn: () => fetchLeaderboard(id),
      refetchInterval: 6_000,
      enabled: !!id,
    })),
  });
  const avgByGc = new Map<string, number | undefined>();
  gcIds.forEach((id, i) => {
    const rows = leaderboards[i]?.data;
    if (!rows || rows.length === 0) {
      avgByGc.set(id, undefined);
      return;
    }
    const sum = rows.reduce((acc, m) => acc + m.currentTemperature, 0);
    avgByGc.set(id, sum / rows.length);
  });

  if (isPending)
    return <GlassCard title="Organization Dashboard">Loading…</GlassCard>;
  if (isError)
    return (
      <GlassCard title="Organization Dashboard">
        Failed: {String(error)}
      </GlassCard>
    );

  return (
    <>
      <GlassCard title="Organization Dashboard" footer={`Org: ${orgId}`}>
        <p className="muted">
          {data.groupChats.length} group chats · {data.topMembers.length} ranked
          members
        </p>
      </GlassCard>

      <GlassCard title="Group chats">
        {data.groupChats.length === 0 ? (
          <div className="muted">
            No group chats yet. Create one from chat with `configureGroupChat`.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Avg °C</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.groupChats.map((gc) => {
                const liveAvg = avgByGc.get(gc.conversationId);
                const displayAvg = liveAvg ?? gc.currentAvgTemperature ?? 36.5;
                return (
                <tr key={String(gc.id ?? gc.conversationId)}>
                  <td>{gc.title}</td>
                  <td>
                    <TempBadge temperature={displayAvg} />
                    {liveAvg === undefined && (
                      <span
                        className="muted"
                        style={{ marginLeft: 8, fontSize: 11 }}
                      >
                        (loading)
                      </span>
                    )}
                  </td>
                  <td className="muted">{gc.status}</td>
                  <td>
                    <button
                      className="btn"
                      onClick={() => onOpenGc(gc.conversationId)}
                    >
                      Open workspace →
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </GlassCard>

      <GlassCard title="Top members across the org">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>User</th>
              <th>Group chat</th>
              <th>Temperature</th>
            </tr>
          </thead>
          <tbody>
            {data.topMembers.map((m, i) => (
              <tr key={`${m.userId}-${m.conversationId}`}>
                <td>{i + 1}</td>
                <td>
                  <strong>{resolveDisplayName(m.userId)}</strong>
                </td>
                <td className="muted">{m.conversationId.slice(0, 18)}</td>
                <td>
                  <TempBadge temperature={m.currentTemperature} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <GlassCard title="Recent audit log">
        {data.auditLogs.length === 0 ? (
          <div className="muted">No audit events yet.</div>
        ) : (
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            {data.auditLogs.slice(0, 12).map((a, i) => (
              <li key={i} style={{ marginBottom: 6, fontSize: 14 }}>
                <code>{new Date(a.at).toLocaleString()}</code> ·{" "}
                <strong>{a.action}</strong> by{" "}
                <strong>{resolveDisplayName(a.actorUserId)}</strong>
                {a.target && (
                  <>
                    {" "}
                    → <code>{String(a.target).slice(0, 18)}</code>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </>
  );
}
