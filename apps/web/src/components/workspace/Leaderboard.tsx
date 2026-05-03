import type { Member } from "../../types";
import { tempTier, labelFromTemp } from "../temp/TempBadge";
import { resolveDisplayName } from "../../lib/demoTeam";

const PALETTE = [
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#22d3ee",
  "#c084fc",
];

function colorFor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++)
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function prettyRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Compact, sidebar-friendly leaderboard. Renders as a vertical list (no
 * table) so it fits the 320px workspace column without overflowing.
 */
export function Leaderboard({
  members,
  onSelect,
  highlightUserId,
}: {
  members: Member[];
  onSelect?: (userId: string) => void;
  highlightUserId?: string;
}) {
  if (!members.length) {
    return (
      <div className="muted">
        No members yet — invite teammates from chat with{" "}
        <code>requestJoinGroupChat</code>.
      </div>
    );
  }
  return (
    <ol className="leaderboard-list">
      {members.map((m, i) => {
        const name = resolveDisplayName(m.userId);
        const tier = tempTier(m.currentTemperature);
        const label = labelFromTemp(m.currentTemperature);
        const isMe = m.userId === highlightUserId;
        const delta = m.delta7d;
        return (
          <li
            key={m.userId}
            className={`leaderboard-row ${isMe ? "is-me" : ""}`}
            onClick={() => onSelect?.(m.userId)}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : -1}
          >
            <span className="lb-rank">{i + 1}</span>
            <span
              className="lb-avatar"
              style={{ background: isMe ? "#2563eb" : colorFor(m.userId) }}
            >
              {initials(name)}
            </span>
            <span className="lb-meta">
              <span className="lb-name" title={name}>
                {name}
                {isMe && <span className="lb-you"> · you</span>}
              </span>
              <span className="lb-role" title={m.workRole}>
                {prettyRole(m.workRole)}
              </span>
            </span>
            <span className={`lb-temp lb-temp--${tier}`} title={label.replace("_", " ")}>
              <strong>{m.currentTemperature.toFixed(1)}°C</strong>
              {delta !== undefined && Math.abs(delta) > 0.05 && (
                <span
                  className="lb-delta"
                  style={{ color: delta >= 0 ? "#86efac" : "#fca5a5" }}
                >
                  {delta >= 0 ? "▲" : "▼"}
                  {Math.abs(delta).toFixed(2)}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
