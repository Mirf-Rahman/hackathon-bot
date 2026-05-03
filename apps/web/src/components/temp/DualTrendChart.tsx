import type { TemperatureEvent } from "../../types";
import { resolveDisplayName } from "../../lib/demoTeam";

/**
 * Overlaid SVG line chart for two temperature series. Auto-fits the value
 * range and draws the X axis as a uniform timeline (since events arrive
 * irregularly we plot by index for visual clarity).
 */

const W = 640;
const H = 220;
const PAD_L = 38;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 28;

const SERIES_COLORS = ["#60a5fa", "#f472b6"];

function buildPath(
  events: TemperatureEvent[],
  totalLen: number,
  yMin: number,
  yMax: number,
): string {
  if (events.length === 0) return "";
  const xRange = W - PAD_L - PAD_R;
  const yRange = H - PAD_T - PAD_B;
  return events
    .map((e, i) => {
      const x = PAD_L + (totalLen <= 1 ? xRange / 2 : (i / (totalLen - 1)) * xRange);
      const y = PAD_T + yRange - ((e.afterValue - yMin) / Math.max(0.1, yMax - yMin)) * yRange;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function DualTrendChart({
  series,
}: {
  series: Array<{ userId: string; events: TemperatureEvent[] }>;
}) {
  const allValues = series.flatMap((s) => s.events.map((e) => e.afterValue));
  if (allValues.length === 0) {
    return (
      <div className="muted" style={{ padding: 12 }}>
        No temperature events for either member yet.
      </div>
    );
  }
  const yMin = Math.min(...allValues, 35.5);
  const yMax = Math.max(...allValues, 38.5);
  const maxLen = Math.max(...series.map((s) => s.events.length));

  // Y axis tick lines
  const ticks: number[] = [];
  for (let t = Math.ceil(yMin); t <= Math.floor(yMax); t++) ticks.push(t);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="none"
        role="img"
        aria-label="Dual temperature trend"
      >
        {ticks.map((t) => {
          const y =
            PAD_T +
            (H - PAD_T - PAD_B) -
            ((t - yMin) / Math.max(0.1, yMax - yMin)) * (H - PAD_T - PAD_B);
          return (
            <g key={t}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="3 4"
              />
              <text
                x={PAD_L - 6}
                y={y + 3}
                fontSize="10"
                fill="rgba(248,250,252,0.55)"
                textAnchor="end"
              >
                {t}°C
              </text>
            </g>
          );
        })}
        {series.map((s, i) => {
          const path = buildPath(s.events, maxLen, yMin, yMax);
          if (!path) return null;
          const color = SERIES_COLORS[i % SERIES_COLORS.length];
          return (
            <g key={s.userId}>
              <path d={path} fill="none" stroke={color} strokeWidth="2" />
              {s.events.map((e, j) => {
                const xRange = W - PAD_L - PAD_R;
                const yRange = H - PAD_T - PAD_B;
                const x =
                  PAD_L +
                  (maxLen <= 1
                    ? xRange / 2
                    : (j / (maxLen - 1)) * xRange);
                const y =
                  PAD_T +
                  yRange -
                  ((e.afterValue - yMin) / Math.max(0.1, yMax - yMin)) * yRange;
                return (
                  <circle
                    key={j}
                    cx={x}
                    cy={y}
                    r="2"
                    fill={color}
                  >
                    <title>
                      {`${resolveDisplayName(s.userId)} · ${e.afterValue.toFixed(2)}°C · ${e.reason}`}
                    </title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div
        className="row"
        style={{ gap: 18, justifyContent: "center", marginTop: 8 }}
      >
        {series.map((s, i) => (
          <span key={s.userId} className="row" style={{ gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: SERIES_COLORS[i % SERIES_COLORS.length],
              }}
            />
            <span style={{ fontSize: 13 }}>{resolveDisplayName(s.userId)}</span>
            <span className="muted" style={{ fontSize: 12 }}>
              ({s.events.length} events)
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
