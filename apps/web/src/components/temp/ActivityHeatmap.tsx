import type { TemperatureEvent } from "../../types";

/**
 * GitHub-style contribution grid: 7 rows (Mon→Sun) × N week columns.
 * Each cell shades by the count of TemperatureEvents on that day, with a
 * faint red tint when the day's net delta was negative. Hover for details.
 */

type Bucket = { count: number; net: number };

const WEEKS = 13;
const DAYS = 7;
const DAY_MS = 86_400_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function ActivityHeatmap({ events }: { events: TemperatureEvent[] }) {
  const todayStart = startOfDay(Date.now());
  // Monday-anchored grid: end on this week's Sunday.
  const dow = new Date(todayStart).getDay(); // 0=Sun..6=Sat
  const daysToSunday = (7 - dow) % 7;
  const gridEnd = todayStart + daysToSunday * DAY_MS;
  const gridStart = gridEnd - (WEEKS * DAYS - 1) * DAY_MS;

  const buckets = new Map<number, Bucket>();
  for (const ev of events) {
    const ts = startOfDay(new Date(ev.occurredAt).getTime());
    if (ts < gridStart || ts > gridEnd) continue;
    const cur = buckets.get(ts) ?? { count: 0, net: 0 };
    cur.count += 1;
    cur.net += ev.delta;
    buckets.set(ts, cur);
  }

  const maxCount = Math.max(1, ...Array.from(buckets.values()).map((b) => b.count));

  const monthLabels: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const ts = gridStart + w * 7 * DAY_MS;
    const m = new Date(ts).getMonth();
    if (m !== lastMonth) {
      monthLabels.push({
        col: w,
        label: new Date(ts).toLocaleString([], { month: "short" }),
      });
      lastMonth = m;
    }
  }

  const totalCount = Array.from(buckets.values()).reduce((a, b) => a + b.count, 0);
  const totalNet = Array.from(buckets.values()).reduce((a, b) => a + b.net, 0);

  return (
    <div className="heatmap">
      <div className="heatmap-header">
        <div className="muted" style={{ fontSize: 12 }}>
          Last {WEEKS} weeks · {totalCount} events ·{" "}
          <span style={{ color: totalNet >= 0 ? "#86efac" : "#fca5a5" }}>
            {totalNet >= 0 ? "+" : ""}
            {totalNet.toFixed(2)}°C net
          </span>
        </div>
        <div className="heatmap-legend">
          <span className="muted">less</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`heatmap-cell heatmap-cell--lvl${i}`}
              aria-hidden
            />
          ))}
          <span className="muted">more</span>
        </div>
      </div>
      <div className="heatmap-grid-wrap">
        <div className="heatmap-day-labels">
          <span>Mon</span>
          <span></span>
          <span>Wed</span>
          <span></span>
          <span>Fri</span>
          <span></span>
          <span></span>
        </div>
        <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)` }}>
          {Array.from({ length: WEEKS }, (_, w) => (
            <div key={w} className="heatmap-col">
              {Array.from({ length: DAYS }, (_, d) => {
                // d=0 is Monday in our visual; convert to actual day-of-week.
                const dayOffset = ((d + 1) % 7) + w * 7;
                const ts = gridStart + dayOffset * DAY_MS;
                if (ts > todayStart) {
                  return <span key={d} className="heatmap-cell heatmap-cell--future" />;
                }
                const b = buckets.get(ts);
                const lvl = b ? Math.min(4, Math.ceil((b.count / maxCount) * 4)) : 0;
                const isNeg = b ? b.net < 0 : false;
                return (
                  <span
                    key={d}
                    className={`heatmap-cell heatmap-cell--lvl${lvl} ${isNeg ? "heatmap-cell--neg" : ""}`}
                    title={
                      b
                        ? `${new Date(ts).toLocaleDateString()} · ${b.count} events · ${b.net >= 0 ? "+" : ""}${b.net.toFixed(2)}°C`
                        : `${new Date(ts).toLocaleDateString()} · no activity`
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div
        className="heatmap-month-labels"
        style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)` }}
      >
        {Array.from({ length: WEEKS }, (_, w) => {
          const m = monthLabels.find((x) => x.col === w);
          return (
            <span key={w} className="muted" style={{ fontSize: 10 }}>
              {m?.label ?? ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
