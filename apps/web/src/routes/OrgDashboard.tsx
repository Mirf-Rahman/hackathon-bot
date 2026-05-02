import { useQuery } from "@tanstack/react-query";
import { fetchOrgDashboard } from "../services/dashboard";
import { GlassCard } from "../components/glass/GlassCard";
import { TempBadge } from "../components/temp/TempBadge";

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
    refetchInterval: 60_000,
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
              {data.groupChats.map((gc) => (
                <tr key={String(gc.id ?? gc.conversationId)}>
                  <td>{gc.title}</td>
                  <td>
                    <TempBadge temperature={gc.currentAvgTemperature ?? 36.5} />
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
              ))}
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
                  <code>{m.userId.slice(0, 14)}</code>
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
                <code>{a.actorUserId.slice(0, 10)}</code>
                {a.target && (
                  <>
                    {" "}
                    → <code>{String(a.target).slice(0, 14)}</code>
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
