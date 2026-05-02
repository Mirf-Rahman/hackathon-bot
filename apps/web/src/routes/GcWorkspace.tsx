import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard } from "../services/dashboard";
import { GlassCard } from "../components/glass/GlassCard";
import { Leaderboard } from "../components/workspace/Leaderboard";
import { GroupChatFeed } from "../components/workspace/GroupChatFeed";

export function GcWorkspace({
  orgId,
  gcId,
  onOpenMember,
}: {
  orgId: string;
  gcId: string;
  onOpenMember: (userId: string) => void;
}) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["leaderboard", gcId],
    queryFn: () => fetchLeaderboard(gcId),
    refetchInterval: 10_000,
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 320px",
        gap: 24,
        alignItems: "start",
      }}
    >
      <GroupChatFeed conversationId={gcId} orgId={orgId} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <GlassCard title="Leaderboard">
          {isPending ? (
            <div className="muted">Loading…</div>
          ) : isError ? (
            <div className="muted">Failed: {String(error)}</div>
          ) : (
            <Leaderboard members={data} onSelect={onOpenMember} />
          )}
        </GlassCard>
        <GlassCard title="About this channel">
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
            <code>{gcId}</code> · org <code>{orgId}</code>
            <br />
            <br />
            The chat dock on the right is your private 1:1 with the PeerTemp bot
            — extract tasks, log activity, request to join. Channel messages
            here go to <code>MessagesTable</code>.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
