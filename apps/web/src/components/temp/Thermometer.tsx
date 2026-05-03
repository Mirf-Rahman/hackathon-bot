import { useEffect, useRef, useState } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import { tempTier, labelFromTemp } from "./TempBadge";

/**
 * Big visual thermometer for the top of a group chat. Scale: 35°C → 40°C
 * (slightly tighter than the bot's clamp range so the mercury swings more
 * dramatically for the demo). Color shifts with tier; numeric value tweens;
 * a fading "+0.12°C" callout appears whenever the value changes.
 */

const MIN = 35;
const MAX = 40;

function pctFor(value: number): number {
  return Math.max(0, Math.min(100, ((value - MIN) / (MAX - MIN)) * 100));
}

export function Thermometer({
  value,
  label,
  sublabel,
}: {
  value: number;
  label?: string;
  sublabel?: string;
}) {
  const tier = tempTier(value);
  const tag = labelFromTemp(value);
  const [delta, setDelta] = useState<number | null>(null);
  const [direction, setDirection] = useState<"up" | "down" | "flat">("flat");
  const lastVal = useRef(value);
  const fadeTimer = useRef<number | null>(null);

  useEffect(() => {
    const diff = value - lastVal.current;
    if (Math.abs(diff) >= 0.005) {
      setDelta(diff);
      setDirection(diff > 0 ? "up" : "down");
      if (fadeTimer.current !== null) window.clearTimeout(fadeTimer.current);
      fadeTimer.current = window.setTimeout(() => {
        setDelta(null);
        setDirection("flat");
      }, 1800);
    }
    lastVal.current = value;
    return () => {
      if (fadeTimer.current !== null) window.clearTimeout(fadeTimer.current);
    };
  }, [value]);

  const pct = pctFor(value);
  const fillColor =
    tier === "cool"
      ? "linear-gradient(180deg, #60a5fa, #2563eb)"
      : tier === "stable"
        ? "linear-gradient(180deg, #34d399, #059669)"
        : tier === "warm"
          ? "linear-gradient(180deg, #fbbf24, #d97706)"
          : "linear-gradient(180deg, #f87171, #b91c1c)";

  return (
    <div
      className={`thermo thermo--${tier} thermo--${direction}`}
      role="img"
      aria-label={`Temperature ${value.toFixed(2)} degrees, ${tag}`}
    >
      <div className="thermo-track" aria-hidden>
        <div
          className="thermo-fill"
          style={{ height: `${pct}%`, background: fillColor }}
        />
        {[36, 37, 38, 39].map((t) => (
          <span
            key={t}
            className="thermo-tick"
            style={{ bottom: `${pctFor(t)}%` }}
          >
            {t}°
          </span>
        ))}
      </div>
      <div className="thermo-meta">
        <div className="thermo-label">{label ?? "Channel temperature"}</div>
        <div className="thermo-value">
          <AnimatedNumber value={value} fractionDigits={2} suffix="°C" />
          <span className={`thermo-tag thermo-tag--${tier}`}>
            {tag.replace("_", " ")}
          </span>
        </div>
        {sublabel && <div className="thermo-sublabel">{sublabel}</div>}
        {delta !== null && (
          <div
            className={`thermo-delta thermo-delta--${direction}`}
            key={`${value}-${delta.toFixed(3)}`}
          >
            {delta >= 0 ? "▲ +" : "▼ "}
            {delta.toFixed(2)}°C
          </div>
        )}
      </div>
    </div>
  );
}
