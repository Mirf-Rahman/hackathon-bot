import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { OrgDashboard } from "./routes/OrgDashboard";
import { GcWorkspace } from "./routes/GcWorkspace";
import { MemberProfile } from "./routes/MemberProfile";
import { ReviewCenter } from "./routes/ReviewCenter";
import { AdminSettings } from "./routes/AdminSettings";
import { Compare } from "./routes/Compare";
import { envIsConfigured, env } from "./lib/env";
import { seedDemoData } from "./services/seed";
import { ChatPanel } from "./components/workspace/ChatPanel";
import { useAuthStore } from "./stores/authStore";
import { DEMO_TEAM } from "./lib/demoTeam";

type View =
  | { kind: "dashboard" }
  | { kind: "gc"; gcId: string }
  | { kind: "member"; userId: string }
  | { kind: "reviews" }
  | { kind: "compare" }
  | { kind: "admin" };

function parseHash(): View {
  const h = window.location.hash.slice(1);
  if (h.startsWith("gc/")) return { kind: "gc", gcId: h.slice(3) };
  if (h.startsWith("member/")) return { kind: "member", userId: h.slice(7) };
  if (h === "reviews") return { kind: "reviews" };
  if (h === "compare") return { kind: "compare" };
  if (h === "admin") return { kind: "admin" };
  return { kind: "dashboard" };
}

const DEFAULT_PERSONA = DEMO_TEAM[0]; // Alex Park (leader)

export default function App() {
  const me = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);

  const [view, setView] = useState<View>(parseHash);
  const [orgId, setOrgId] = useState(
    () => localStorage.getItem("peertemp.orgId") ?? "",
  );
  const qc = useQueryClient();

  // Default to Alex Park on first load — no login screen.
  useEffect(() => {
    if (!me) {
      signIn({
        userId: DEFAULT_PERSONA.userId,
        displayName: DEFAULT_PERSONA.displayName,
        role: DEFAULT_PERSONA.role,
        demoPersona: DEFAULT_PERSONA.userId,
      });
    }
  }, [me, signIn]);

  // Auto-seed once on load (idempotent on the bot side).
  const autoSeed = useMutation({
    mutationFn: () => seedDemoData(false),
    onSuccess: (data) => {
      if (!orgId && data.organizationId) setOrgId(data.organizationId);
      qc.invalidateQueries();
    },
  });
  useEffect(() => {
    if (envIsConfigured() && !orgId && !autoSeed.isPending && !autoSeed.data) {
      autoSeed.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHash = () => setView(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    localStorage.setItem("peertemp.orgId", orgId);
  }, [orgId]);

  const go = (h: string) => {
    window.location.hash = h;
  };

  return (
    <div className="app-shell">
      <aside className="nav">
        <h1>🌡️ PeerTemp</h1>

        <PersonaSwitcher />

        <a className={view.kind === "dashboard" ? "active" : ""} href="#">
          Dashboard
        </a>
        {me && (
          <a
            className={
              view.kind === "member" && view.userId === me.userId
                ? "active"
                : ""
            }
            href={`#member/${encodeURIComponent(me.userId)}`}
          >
            My profile
          </a>
        )}
        <a className={view.kind === "reviews" ? "active" : ""} href="#reviews">
          Reviews
        </a>
        <a className={view.kind === "compare" ? "active" : ""} href="#compare">
          Compare members
        </a>
        <a className={view.kind === "admin" ? "active" : ""} href="#admin">
          Admin
        </a>

        <div style={{ marginTop: 24 }}>
          <div className="muted" style={{ marginBottom: 6, fontSize: 12 }}>
            Active org id
          </div>
          <input
            className="input"
            placeholder="organization id"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 24, fontSize: 12 }} className="muted">
          Bot: <code>{env.botId.slice(0, 10) || "(unset)"}</code>
          <br />
          WS: <code>{env.workspaceId.slice(0, 10) || "(unset)"}</code>
          <br />
          Chat: <code>{env.chatApiUrl ? "✓ live" : "(disabled)"}</code>
        </div>
      </aside>

      <main className="main">
        {!envIsConfigured() && (
          <div className="banner">
            Configure <code>apps/web/.env</code> with your Botpress workspace,
            bot id, and PAT to connect this UI to the running bot.
          </div>
        )}

        {!orgId && (
          <SeedBanner
            onSeeded={(id) => setOrgId(id)}
            seedingInline={autoSeed.isPending}
            error={autoSeed.error ? String(autoSeed.error) : null}
          />
        )}

        {orgId && view.kind === "dashboard" && (
          <OrgDashboard
            orgId={orgId}
            onOpenGc={(gcId) => go(`gc/${encodeURIComponent(gcId)}`)}
          />
        )}
        {orgId && view.kind === "gc" && (
          <GcWorkspace
            orgId={orgId}
            gcId={view.gcId}
            onOpenMember={(uid) => go(`member/${encodeURIComponent(uid)}`)}
          />
        )}
        {orgId && view.kind === "member" && (
          <MemberProfile userId={view.userId} orgId={orgId} />
        )}
        {orgId && view.kind === "reviews" && <ReviewCenter orgId={orgId} />}
        {orgId && view.kind === "compare" && <Compare orgId={orgId} />}
        {view.kind === "admin" && (
          <AdminSettings orgId={orgId} onOrgIdChange={setOrgId} />
        )}
      </main>

      <aside className="dock">
        <ChatPanel
          conversationId={
            view.kind === "gc"
              ? `gc-${view.gcId}`
              : view.kind === "member"
                ? `dm-${view.userId}`
                : `org-${orgId || "lobby"}`
          }
        />
      </aside>
    </div>
  );
}

function PersonaSwitcher() {
  const me = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  if (!me) return null;
  return (
    <div className="user-chip glass" style={{ marginBottom: 16 }}>
      <div className="user-chip-avatar">{initials(me.displayName)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="user-chip-name" title={me.displayName}>
          {me.displayName}
        </div>
        <div className="user-chip-role">{me.role}</div>
        <select
          className="select"
          style={{ marginTop: 6, fontSize: 12, padding: "4px 6px" }}
          value={me.userId}
          onChange={(e) => {
            const p = DEMO_TEAM.find((m) => m.userId === e.target.value);
            if (p) {
              signIn({
                userId: p.userId,
                displayName: p.displayName,
                role: p.role,
                demoPersona: p.userId,
              });
            }
          }}
        >
          {DEMO_TEAM.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.displayName} ({p.role})
            </option>
          ))}
        </select>
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

function SeedBanner({
  onSeeded,
  seedingInline,
  error,
}: {
  onSeeded: (orgId: string) => void;
  seedingInline?: boolean;
  error?: string | null;
}) {
  const qc = useQueryClient();
  const seed = useMutation({
    mutationFn: () => seedDemoData(false),
    onSuccess: (data) => {
      onSeeded(data.organizationId);
      qc.invalidateQueries();
    },
  });
  const isPending = seedingInline || seed.isPending;
  return (
    <div
      className="banner"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <strong>{isPending ? "Seeding Acme Inc.…" : "No organization selected."}</strong>
      <span style={{ flex: 1, minWidth: 240 }}>
        Acme Inc. seeds 3 group chats, 8 members, two weeks of temperature
        history, tasks, peer/leader reviews, and audit log entries.
      </span>
      <button
        className="btn btn-primary"
        disabled={isPending}
        onClick={() => seed.mutate()}
      >
        {isPending ? "Seeding…" : "Seed demo data"}
      </button>
      {(seed.isError || error) && (
        <span style={{ width: "100%" }}>
          Failed: {String(seed.error ?? error)}
        </span>
      )}
    </div>
  );
}
