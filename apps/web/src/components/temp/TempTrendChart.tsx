import type { TemperatureEvent } from "../../types";

/**
 * Lightweight bar sparkline of temperature events. We avoid an extra chart
 * dependency to keep the bundle tiny and the visual a11y simple.
 */
export function TempTrendChart({ events }: { events: TemperatureEvent[] }) {
  if (!events.length) {
    return (
      <div className="muted">
        Temperature history appears after your first scored action.
      </div>
    );
  }
  const values = events.map((e) => e.afterValue);
  const min = Math.min(...values, 35);
  const max = Math.max(...values, 40);
  const range = Math.max(0.1, max - min);

  return (
    <div>
      <div className="spark" role="img" aria-label="Temperature trend">
        {events.slice(-60).map((e, i) => {
          const pct = ((e.afterValue - min) / range) * 100;
          return (
            <div
              key={i}
              className="spark-bar"
              style={{
                height: `${Math.max(6, pct)}%`,
                opacity: 0.55 + (pct / 100) * 0.45,
              }}
              title={`${e.afterValue.toFixed(2)}°C — ${e.reason}`}
            />
          );
        })}
      </div>
      <div
        className="row"
        style={{ justifyContent: "space-between", marginTop: 8 }}
      >
        <span className="muted">
          {new Date(events[0].occurredAt).toLocaleDateString()}
        </span>
        <span className="muted">
          {min.toFixed(1)}°C – {max.toFixed(1)}°C
        </span>
      </div>
    </div>
  );
}
