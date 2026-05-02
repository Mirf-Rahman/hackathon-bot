import type { ReactNode } from "react";

export function GlassCard({
  title,
  children,
  footer,
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="glass card">
      {title && <h2>{title}</h2>}
      <div>{children}</div>
      {footer && (
        <div className="muted" style={{ marginTop: 12 }}>
          {footer}
        </div>
      )}
    </section>
  );
}
