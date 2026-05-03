import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listGcMessages,
  postGcMessage,
  type GcMessage,
} from "../../services/groupChat";
import { logTemperatureEvent } from "../../services/temperature";
import { useAuthStore } from "../../stores/authStore";
import { resolveDisplayName } from "../../lib/demoTeam";
import { ensureConversation, getChatClient } from "../../lib/chatClient";
import { env } from "../../lib/env";
import {
  scoreText,
  deltaCopy,
  toneColor,
  toneIcon,
  intentLabel,
} from "../../lib/tone";

const PALETTE = [
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#22d3ee",
  "#c084fc",
];

function colorFor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++)
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
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

/**
 * Multi-author group chat feed for a GC. Reads from the bot's MessagesTable
 * via `listGcMessages`. On send we (a) immediately persist via the
 * `postGcMessage` action so the row shows up alongside seeded teammates, and
 * (b) — if the chat integration is configured — also pipe the same text into
 * the bot's chat conversation so the AI scores tone, extracts tasks, and
 * updates temperature in real time.
 */
export function GroupChatFeed({
  conversationId,
  orgId,
}: {
  conversationId: string;
  orgId: string;
}) {
  const me = useAuthStore((s) => s.user);
  const meUserId = me?.userId ?? "user_anonymous";
  const meDisplayName = me?.displayName ?? "You";

  const qc = useQueryClient();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["gcMessages", conversationId],
    queryFn: () => listGcMessages(conversationId),
    refetchInterval: 4_000,
  });

  const send = useMutation({
    mutationFn: async (text: string) => {
      // 1. Persist immediately so it's visible in the feed.
      await postGcMessage({
        conversationId,
        organizationId: orgId,
        senderUserId: meUserId,
        senderDisplayName: meDisplayName,
        text,
      });

      // 2. Move the temperature so the leaderboard reflects the post within
      //    the next refetch cycle. We log directly via the
      //    `logTemperatureEvent` action so this works whether or not the
      //    chat integration is reachable.
      const preview = scoreText(text);
      if (preview.delta !== 0) {
        try {
          await logTemperatureEvent({
            userId: meUserId,
            organizationId: orgId,
            conversationId,
            delta: preview.delta,
            reason: preview.reason,
            sourceType: "language",
          });
        } catch {
          // Non-fatal — leaderboard simply won't move on this turn.
        }
      }

      // 3. Best-effort: also forward to the bot via the chat integration so
      //    the conversation router runs (scoreLanguage, tools, decay etc.).
      if (env.chatApiUrl) {
        try {
          const { conversationId: cid, client } = await ensureConversation(
            `peertemp-gc-${conversationId}`,
          );
          await client.createMessage({
            conversationId: cid,
            payload: { type: "text", text },
          } as any);
        } catch {
          // Non-fatal; message is already in MessagesTable.
        }
      }
    },
    onSuccess: () => {
      // Refresh both the message feed AND the leaderboard / member profile
      // so the temperature change is visible immediately.
      qc.invalidateQueries({ queryKey: ["gcMessages", conversationId] });
      qc.invalidateQueries({ queryKey: ["leaderboard", conversationId] });
      qc.invalidateQueries({ queryKey: ["memberProfile", meUserId] });
      qc.invalidateQueries({ queryKey: ["orgDashboard"] });
    },
  });

  const [input, setInput] = useState("");
  const [lastDelta, setLastDelta] = useState<{
    delta: number;
    reason: string;
    at: number;
  } | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data?.length]);

  // Auto-clear the post-send toast after 2.5s
  useEffect(() => {
    if (!lastDelta) return;
    const id = window.setTimeout(() => setLastDelta(null), 2500);
    return () => window.clearTimeout(id);
  }, [lastDelta]);

  const grouped = useMemo(() => groupConsecutive(data ?? []), [data]);
  const preview = input.trim() ? scoreText(input) : null;

  const submit = (raw?: string) => {
    const t = (raw ?? input).trim();
    if (!t) return;
    const scored = scoreText(t);
    setInput("");
    setLastDelta({ delta: scored.delta, reason: scored.reason, at: Date.now() });
    send.mutate(t);
  };

  return (
    <section
      className="glass card"
      style={{
        padding: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 520,
        maxHeight: "70vh",
      }}
    >
      <header
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 18 }}>#</span>
        <strong style={{ flex: 1 }}>{conversationId}</strong>
        <span className="muted" style={{ fontSize: 12 }}>
          {data?.length ?? 0} messages · posting as <strong>{meDisplayName}</strong>
        </span>
      </header>

      <div
        ref={scroller}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {isPending && <div className="muted">Loading messages…</div>}
        {isError && (
          <div className="banner">Failed to load: {String(error)}</div>
        )}
        {!isPending && (data?.length ?? 0) === 0 && (
          <div className="muted">
            No messages yet for this group chat. Seed demo data from the sidebar
            to populate it.
          </div>
        )}
        {grouped.map((g) => (
          <MessageGroup key={g.key} group={g} meUserId={meUserId} />
        ))}
      </div>

      <footer
        style={{
          padding: 12,
          borderTop: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          position: "relative",
        }}
      >
        {lastDelta && (
          <div
            className={`tone-toast tone-toast--${lastDelta.delta >= 0 ? "up" : "down"}`}
          >
            {lastDelta.delta >= 0 ? "▲ +" : "▼ "}
            {lastDelta.delta.toFixed(2)}°C · {lastDelta.reason}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder={`Message #${conversationId} as ${meDisplayName}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && input.trim()) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            className="btn btn-primary"
            disabled={send.isPending || !input.trim()}
            onClick={() => submit()}
          >
            {send.isPending ? "Sending…" : "Send"}
          </button>
        </div>
        <div className="tone-preview" aria-live="polite">
          {preview ? (
            <div className="tone-row">
              <span
                className="tone-chip"
                style={{
                  background: `${toneColor(preview.tone)}22`,
                  borderColor: `${toneColor(preview.tone)}66`,
                  color: toneColor(preview.tone),
                }}
                title={preview.reason}
              >
                <span aria-hidden>{toneIcon(preview.tone)}</span>
                <strong>{deltaCopy(preview.delta)}</strong>
              </span>
              <span className="tone-signals">
                {preview.signals.length === 0 ? (
                  <span className="muted" style={{ fontSize: 11 }}>
                    {preview.reason}
                  </span>
                ) : (
                  preview.signals.slice(0, 3).map((s, i) => (
                    <span
                      key={i}
                      className={`tone-tag ${s.delta >= 0 ? "tone-tag--pos" : "tone-tag--neg"}`}
                      title={s.reason}
                    >
                      {intentLabel(s.intent)}
                      <span style={{ opacity: 0.7, marginLeft: 4 }}>
                        {s.delta >= 0 ? "+" : ""}
                        {s.delta.toFixed(2)}
                      </span>
                    </span>
                  ))
                )}
              </span>
            </div>
          ) : (
            <span className="muted" style={{ fontSize: 11 }}>
              Tip: commitments, completions, and substantive updates raise
              your °C; complaints, lazy acks, and rude language drop it.
            </span>
          )}
        </div>
      </footer>
    </section>
  );
}

// Pre-warm the chat client lazily so the very first send is snappy.
void getChatClient;

type Group = {
  key: string;
  senderUserId: string;
  senderDisplayName: string;
  postedAt: string;
  messages: GcMessage[];
};

function groupConsecutive(msgs: GcMessage[]): Group[] {
  const out: Group[] = [];
  for (const m of msgs) {
    const last = out[out.length - 1];
    if (
      last &&
      last.senderUserId === m.senderUserId &&
      new Date(m.postedAt).getTime() -
        new Date(last.messages[last.messages.length - 1].postedAt).getTime() <
        5 * 60_000
    ) {
      last.messages.push(m);
    } else {
      out.push({
        key: `${m.senderUserId}-${m.postedAt}`,
        senderUserId: m.senderUserId,
        senderDisplayName: resolveDisplayName(m.senderUserId, m.senderDisplayName),
        postedAt: m.postedAt,
        messages: [m],
      });
    }
  }
  return out;
}

function MessageGroup({ group, meUserId }: { group: Group; meUserId: string }) {
  const isMe = group.senderUserId === meUserId;
  const color = isMe ? "#2563eb" : colorFor(group.senderUserId);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {initials(group.senderDisplayName)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <strong style={{ fontSize: 14 }}>
            {group.senderDisplayName}
            {isMe && (
              <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>
                (you)
              </span>
            )}
          </strong>
          <span className="muted" style={{ fontSize: 11 }}>
            {new Date(group.postedAt).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            marginTop: 2,
          }}
        >
          {group.messages.map((m) => (
            <div
              key={m.id}
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color:
                  m.professionalism === "unprofessional"
                    ? "#fca5a5"
                    : "#f8fafc",
              }}
              title={
                m.professionalism ? `tone: ${m.professionalism}` : undefined
              }
            >
              {m.text ?? <em className="muted">(no content)</em>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
