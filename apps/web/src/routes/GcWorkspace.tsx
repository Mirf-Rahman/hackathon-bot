import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard } from "../services/dashboard";
import { GlassCard } from "../components/glass/GlassCard";
import { Leaderboard } from "../components/workspace/Leaderboard";
import { GroupChatFeed } from "../components/workspace/GroupChatFeed";
import { Thermometer } from "../components/temp/Thermometer";
import { useAuthStore } from "../stores/authStore";

export function GcWorkspace({
  orgId,
  gcId,
  onOpenMember,
}: {
  orgId: string;
  gcId: string;
  onOpenMember: (userId: string) => void;
}) {
  const me = useAuthStore((s) => s.user);
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["leaderboard", gcId],
    queryFn: () => fetchLeaderboard(gcId),
    refetchInterval: 4_000,
  });

  const liveAvg =
    data && data.length
      ? data.reduce((a, m) => a + m.currentTemperature, 0) / data.length
      : undefined;
  const myTemp = data?.find((m) => m.userId === me?.userId)?.currentTemperature;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 340px",
        gap: 24,
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {liveAvg !== undefined && (
          <Thermometer
            value={liveAvg}
            label={`# ${gcId}`}
            sublabel={`${data?.length ?? 0} members · live average`}
          />
        )}
        <GroupChatFeed conversationId={gcId} orgId={orgId} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {myTemp !== undefined && (
          <Thermometer
            value={myTemp}
            label="Your temperature"
            sublabel="Updates after each post"
          />
        )}
        <GlassCard
          title="Leaderboard"
          footer="Updates within seconds of each post"
        >
          {isPending ? (
            <div className="muted">Loading…</div>
          ) : isError ? (
            <div className="muted">Failed: {String(error)}</div>
          ) : (
            <Leaderboard
              members={data}
              onSelect={onOpenMember}
              highlightUserId={me?.userId}
            />
          )}
        </GlassCard>
        <GlassCard title="About this channel">
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
            <code>{gcId}</code> · org <code>{orgId}</code>
            <br />
            <br />
            Send a meaningful message and watch your °C tick up. Short replies
            stay flat; unprofessional language drops you. The bot's full
            scoring still runs in the background.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
