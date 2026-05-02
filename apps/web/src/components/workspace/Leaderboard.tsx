import type { Member } from "../../types";
import { TempBadge } from "../temp/TempBadge";

export function Leaderboard({
  members,
  onSelect,
}: {
  members: Member[];
  onSelect?: (userId: string) => void;
}) {
  if (!members.length) {
    return (
      <div className="muted">
        No members yet — invite teammates from chat with `requestJoinGroupChat`.
      </div>
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Member</th>
          <th>Role</th>
          <th>Temperature</th>
          <th>7d Δ</th>
        </tr>
      </thead>
      <tbody>
        {members.map((m, i) => (
          <tr
            key={m.userId}
            onClick={() => onSelect?.(m.userId)}
            style={{ cursor: onSelect ? "pointer" : "default" }}
          >
            <td>{i + 1}</td>
            <td>
              <code>{m.userId.slice(0, 14)}</code>
            </td>
            <td>
              <span className="muted">{m.workRole}</span>
            </td>
            <td>
              <TempBadge temperature={m.currentTemperature} />
            </td>
            <td className="muted">
              {m.delta7d === undefined
                ? "—"
                : `${m.delta7d > 0 ? "+" : ""}${m.delta7d.toFixed(2)}°C`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
