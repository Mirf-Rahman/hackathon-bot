import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listGcMessages,
  postGcMessage,
  type GcMessage,
} from "../../services/groupChat";

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
 * via `listGcMessages`. Posting writes through `postGcMessage` so the user's
 * line shows up alongside seeded teammates. The right-side dock remains the
 * private 1:1 with the PeerTemp bot (task extraction, reviews, etc).
 */
export function GroupChatFeed({
  conversationId,
  orgId,
  meUserId = "user_demo_you",
  meDisplayName = "You",
}: {
  conversationId: string;
  orgId: string;
  meUserId?: string;
  meDisplayName?: string;
}) {
  const qc = useQueryClient();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["gcMessages", conversationId],
    queryFn: () => listGcMessages(conversationId),
    refetchInterval: 8_000,
  });

  const send = useMutation({
    mutationFn: (text: string) =>
      postGcMessage({
        conversationId,
        organizationId: orgId,
        senderUserId: meUserId,
        senderDisplayName: meDisplayName,
        text,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["gcMessages", conversationId] }),
  });

  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data?.length]);

  const grouped = useMemo(() => groupConsecutive(data ?? []), [data]);

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
          {data?.length ?? 0} messages
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
          gap: 8,
        }}
      >
        <input
          className="input"
          placeholder={`Message #${conversationId}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && input.trim()) {
              e.preventDefault();
              const t = input.trim();
              setInput("");
              send.mutate(t);
            }
          }}
        />
        <button
          className="btn btn-primary"
          disabled={send.isPending || !input.trim()}
          onClick={() => {
            const t = input.trim();
            if (!t) return;
            setInput("");
            send.mutate(t);
          }}
        >
          Send
        </button>
      </footer>
    </section>
  );
}

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
        senderDisplayName: m.senderDisplayName ?? m.senderUserId,
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
          <strong style={{ fontSize: 14 }}>{group.senderDisplayName}</strong>
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
