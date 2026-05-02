import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { OrgDashboard } from "./routes/OrgDashboard";
import { GcWorkspace } from "./routes/GcWorkspace";
import { MemberProfile } from "./routes/MemberProfile";
import { ReviewCenter } from "./routes/ReviewCenter";
import { AdminSettings } from "./routes/AdminSettings";
import { envIsConfigured, env } from "./lib/env";
import { seedDemoData } from "./services/seed";
import { ChatPanel } from "./components/workspace/ChatPanel";

type View =
  | { kind: "dashboard" }
  | { kind: "gc"; gcId: string }
  | { kind: "member"; userId: string }
  | { kind: "reviews" }
  | { kind: "admin" };

function parseHash(): View {
  const h = window.location.hash.slice(1);
  if (h.startsWith("gc/")) return { kind: "gc", gcId: h.slice(3) };
  if (h.startsWith("member/")) return { kind: "member", userId: h.slice(7) };
  if (h === "reviews") return { kind: "reviews" };
  if (h === "admin") return { kind: "admin" };
  return { kind: "dashboard" };
}

export default function App() {
  const [view, setView] = useState<View>(parseHash);
  const [orgId, setOrgId] = useState(
    () => localStorage.getItem("peertemp.orgId") ?? "",
  );

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
        <a className={view.kind === "dashboard" ? "active" : ""} href="#">
          Dashboard
        </a>
        <a className={view.kind === "reviews" ? "active" : ""} href="#reviews">
          Reviews
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
        </div>
      </aside>

      <main className="main">
        {!envIsConfigured() && (
          <div className="banner">
            Configure <code>apps/web/.env</code> with your Botpress workspace,
            bot id, and PAT to connect this UI to the running bot.
          </div>
        )}

        {!orgId && <SeedBanner onSeeded={(id) => setOrgId(id)} />}

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

function SeedBanner({ onSeeded }: { onSeeded: (orgId: string) => void }) {
  const qc = useQueryClient();
  const seed = useMutation({
    mutationFn: () => seedDemoData(false),
    onSuccess: (data) => {
      onSeeded(data.organizationId);
      qc.invalidateQueries();
    },
  });
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
      <strong>No organization selected.</strong>
      <span style={{ flex: 1, minWidth: 240 }}>
        Click below to seed <em>Acme Inc.</em> with realistic chats, members,
        tasks, reviews, and two weeks of temperature history.
      </span>
      <button
        className="btn btn-primary"
        disabled={seed.isPending}
        onClick={() => seed.mutate()}
      >
        {seed.isPending ? "Seeding…" : "Seed demo data"}
      </button>
      {seed.isError && (
        <span style={{ width: "100%" }}>Failed: {String(seed.error)}</span>
      )}
    </div>
  );
}
