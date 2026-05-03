import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore, type Role } from "../stores/authStore";
import { DEMO_TEAM, type DemoPersona } from "../lib/demoTeam";
import { TempBadge } from "../components/temp/TempBadge";
import { envIsConfigured, env } from "../lib/env";
import { seedDemoData } from "../services/seed";

/**
 * Sign-in screen. Two paths:
 *   1. "Continue as <demo persona>" — instant: inherits 2 weeks of seeded
 *      history (tasks, reviews, temperature events, consent).
 *   2. "Create new account" — name + email + role; the user is a "ghost" that
 *      will be picked up by the bot's consent gate on first chat message.
 *
 * Either way we (a) ensure demo data exists by calling `seedDemoData` and (b)
 * persist the chosen identity to the auth store, which flows into the chat
 * client + GroupChatFeed.
 */
export function Login({
  onSignedIn,
}: {
  onSignedIn: (orgId: string) => void;
}) {
  const signIn = useAuthStore((s) => s.signIn);
  const [mode, setMode] = useState<"team" | "new">("team");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);

  const ensureSeed = useMutation({
    mutationFn: () => seedDemoData(false),
  });

  async function pickPersona(p: DemoPersona) {
    setError(null);
    try {
      const result = envIsConfigured() ? await ensureSeed.mutateAsync() : null;
      signIn({
        userId: p.userId,
        displayName: p.displayName,
        role: p.role,
        demoPersona: p.userId,
      });
      if (result?.organizationId) onSignedIn(result.organizationId);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function continueAsNew() {
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    const handle = (
      email.trim().toLowerCase() ||
      name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
    )
      .replace(/[^a-z0-9.@-]/g, "")
      .slice(0, 64);
    const userId = `user_${handle || "guest"}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const result = envIsConfigured() ? await ensureSeed.mutateAsync() : null;
      signIn({
        userId,
        displayName: name.trim(),
        email: email.trim() || undefined,
        role,
      });
      if (result?.organizationId) onSignedIn(result.organizationId);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  return (
    <div className="login-shell">
      <div className="login-grid">
        <section className="glass login-card">
          <div className="login-brand">
            <span style={{ fontSize: 28 }}>🌡️</span>
            <h1>PeerTemp</h1>
          </div>
          <p className="muted" style={{ marginTop: 0, lineHeight: 1.5 }}>
            An AI-tracked group chat that gives every teammate a live{" "}
            <strong>°C temperature</strong> based on responsiveness, task
            completion, peer reviews, and tone of voice.
          </p>

          {!envIsConfigured() && (
            <div className="banner" style={{ marginBottom: 16 }}>
              <strong>Backend not connected.</strong> Add{" "}
              <code>VITE_BOTPRESS_*</code> values to{" "}
              <code>apps/web/.env</code> and run <code>npm run dev</code> at the
              repo root. You can still browse the UI but data calls will fail.
            </div>
          )}

          <div className="login-tabs">
            <button
              className={`pt-nav-btn ${mode === "team" ? "active" : ""}`}
              onClick={() => setMode("team")}
            >
              Continue as a teammate
            </button>
            <button
              className={`pt-nav-btn ${mode === "new" ? "active" : ""}`}
              onClick={() => setMode("new")}
            >
              Create new account
            </button>
          </div>

          {mode === "team" && (
            <>
              <p className="muted" style={{ fontSize: 13 }}>
                Pick one of the seeded Acme Inc. employees to inherit their
                two-week history. Best for the demo.
              </p>
              <div className="persona-grid">
                {DEMO_TEAM.map((p) => (
                  <button
                    key={p.userId}
                    className="glass persona-card"
                    onClick={() => pickPersona(p)}
                    disabled={ensureSeed.isPending}
                  >
                    <div className="persona-row">
                      <div className="persona-avatar">{initials(p.displayName)}</div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div className="persona-name">{p.displayName}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {p.workRole} ·{" "}
                          <span style={{ textTransform: "uppercase" }}>
                            {p.role}
                          </span>
                        </div>
                      </div>
                      <TempBadge temperature={p.temperature} />
                    </div>
                    <div className="persona-blurb muted">{p.blurb}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === "new" && (
            <div className="new-form">
              <label>
                <span className="muted">Display name</span>
                <input
                  className="input"
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </label>
              <label>
                <span className="muted">Email (optional, used as your stable id)</span>
                <input
                  className="input"
                  placeholder="ada@acme.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                <span className="muted">Role</span>
                <select
                  className="select"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  <option value="member">Member</option>
                  <option value="leader">Leader (can review + approve joins)</option>
                  <option value="admin">Admin (full org control)</option>
                  <option value="observer">Observer (read-only)</option>
                </select>
              </label>
              <button
                className="btn btn-primary"
                onClick={continueAsNew}
                disabled={!name.trim() || ensureSeed.isPending}
              >
                {ensureSeed.isPending ? "Provisioning…" : "Sign in"}
              </button>
              <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>
                You'll start at <strong>36.5°C</strong>. The bot greets you with
                the consent charter on your first message.
              </p>
            </div>
          )}

          {error && (
            <div className="banner" style={{ marginTop: 16 }}>
              {error}
            </div>
          )}
          {ensureSeed.isError && !error && (
            <div className="banner" style={{ marginTop: 16 }}>
              Failed to ensure demo data: {String(ensureSeed.error)}
            </div>
          )}
        </section>

        <aside className="login-side glass">
          <h2 style={{ marginTop: 0 }}>How it works</h2>
          <ol style={{ paddingLeft: 18, lineHeight: 1.6, fontSize: 14 }}>
            <li>
              <strong>Group chat</strong> — your team talks here like Slack.
              Every message is scored for tone + meaningful contribution.
            </li>
            <li>
              <strong>Tasks</strong> — when someone commits to work, the AI
              extracts a structured task and tracks completion.
            </li>
            <li>
              <strong>Peer & leader reviews</strong> — feedback in °C goes
              straight into the temperature log.
            </li>
            <li>
              <strong>Decay + streaks</strong> — cron drifts you cooler if
              you're inactive, hotter on completion streaks.
            </li>
          </ol>
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              background: "rgba(0,0,0,0.18)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
            className="muted"
          >
            <div style={{ marginBottom: 6 }}>
              <strong style={{ color: "#fff" }}>Connected to</strong>
            </div>
            Bot <code>{env.botId.slice(0, 12) || "(unset)"}</code>
            <br />
            Workspace <code>{env.workspaceId.slice(0, 12) || "(unset)"}</code>
            <br />
            Chat API <code>{env.chatApiUrl ? "✓ live" : "(not set)"}</code>
          </div>
        </aside>
      </div>
    </div>
  );
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
