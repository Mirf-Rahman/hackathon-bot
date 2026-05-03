import { useState } from "react";
import type { PerformanceLabel } from "../../types";
import { AnimatedNumber } from "./AnimatedNumber";

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
  animate = true,
}: {
  temperature: number;
  label?: PerformanceLabel;
  animate?: boolean;
}) {
  const tier = tempTier(temperature);
  const computedLabel = label ?? labelFromTemp(temperature);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  return (
    <span
      className={`badge badge--${tier} ${flash ? `badge--flash-${flash}` : ""}`}
      aria-label={`Temperature ${temperature.toFixed(1)} degrees, status ${computedLabel}`}
    >
      <strong>
        {animate ? (
          <AnimatedNumber
            value={temperature}
            fractionDigits={1}
            suffix="°C"
            onDirection={(dir) => {
              if (dir === "flat") return;
              setFlash(dir);
              window.setTimeout(() => setFlash(null), 900);
            }}
          />
        ) : (
          `${temperature.toFixed(1)}°C`
        )}
      </strong>
      <span style={{ opacity: 0.85, fontWeight: 400 }}>
        {computedLabel.replace("_", " ")}
      </span>
    </span>
  );
}
