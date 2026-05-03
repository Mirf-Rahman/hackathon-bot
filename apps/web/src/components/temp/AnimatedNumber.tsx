import { useEffect, useRef, useState } from "react";

/**
 * Smoothly tweens a numeric value over `durationMs` using requestAnimationFrame.
 * Optionally calls `onDirection` whenever the target value changes so callers
 * can flash a color (green up / red down).
 */
export function AnimatedNumber({
  value,
  fractionDigits = 1,
  suffix = "",
  durationMs = 600,
  onDirection,
  className,
  style,
}: {
  value: number;
  fractionDigits?: number;
  suffix?: string;
  durationMs?: number;
  onDirection?: (dir: "up" | "down" | "flat") => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const targetRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (Math.abs(value - targetRef.current) < 0.005) return;
    const dir =
      value > targetRef.current ? "up" : value < targetRef.current ? "down" : "flat";
    fromRef.current = display;
    targetRef.current = value;
    startRef.current = null;
    onDirection?.(dir);

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (targetRef.current - fromRef.current) * eased;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return (
    <span className={className} style={style}>
      {display.toFixed(fractionDigits)}
      {suffix}
    </span>
  );
}
