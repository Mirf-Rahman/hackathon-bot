import type { PerformanceLabel } from "../../types";

export function tempTier(temp: number): "cool" | "stable" | "warm" | "hot" {
  if (temp < 36.0) return "cool";
  if (temp < 37.2) return "stable";
  if (temp < 38.5) return "warm";
  return "hot";
}

export function labelFromTemp(temp: number): PerformanceLabel {
  if (temp >= 38.5) return "outstanding";
  if (temp >= 37.2) return "strong";
  if (temp >= 36.2) return "stable";
  if (temp >= 35.5) return "at_risk";
  return "critical";
}

export function TempBadge({
  temperature,
  label,
}: {
  temperature: number;
  label?: PerformanceLabel;
}) {
  const tier = tempTier(temperature);
  const computedLabel = label ?? labelFromTemp(temperature);
  return (
    <span
      className={`badge badge--${tier}`}
      aria-label={`Temperature ${temperature.toFixed(1)} degrees, status ${computedLabel}`}
    >
      <strong>{temperature.toFixed(1)}°C</strong>
      <span style={{ opacity: 0.85, fontWeight: 400 }}>
        {computedLabel.replace("_", " ")}
      </span>
    </span>
  );
}
