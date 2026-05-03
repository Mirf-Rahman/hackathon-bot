import { useEffect, useMemo, useRef, useState } from "react";
import { env } from "../../lib/env";
import { ensureConversation, getChatClient } from "../../lib/chatClient";
import { useAuthStore } from "../../stores/authStore";

type Msg = {
  id: string;
  authorIsBot: boolean;
  text: string;
  createdAt: string;
};

/**
 * Real in-app chat with the PeerTemp bot. Uses the bot's `chat` integration
 * webhook (no iframe). Each route gets its own conversation, mirroring the
 * platform's group-chat model. The bot's consent gate runs on first message.
 */
export function ChatPanel({ conversationId }: { conversationId?: string }) {
  const me = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "ready" | "error"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Per-route conversation key — falls back to a global "lobby" when no GC.
  const conversationKey = useMemo(
    () => `peertemp-${conversationId ?? "lobby"}`,
    [conversationId],
  );

  useEffect(() => {
    let cancelled = false;
    let listener: any | null = null;

    async function boot() {
      if (!env.chatApiUrl) {
        setStatus("error");
        setError(
          "Set VITE_BOTPRESS_CHAT_API_URL in apps/web/.env to enable live chat.",
        );
        return;
      }
      setStatus("connecting");
      setMessages([]);
      try {
        const { conversationId: cid, client } =
          await ensureConversation(conversationKey);
        if (cancelled) return;
        setConvId(cid);

        const { messages: history } = await client.listMessages({
          conversationId: cid,
        } as any);
        if (cancelled) return;
        setMessages(
          (history as any[])
            .slice()
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            )
            .map(toMsg),
        );

        try {
          listener = await client.listenConversation({ id: cid } as any);
          listener.on("message_created", (ev: any) => {
            if (cancelled) return;
            const m = toMsg(ev.data ?? ev);
            setMessages((prev) =>
              prev.find((x) => x.id === m.id) ? prev : [...prev, m],
            );
          });
        } catch {
          // listener is a nice-to-have; falls back to optimistic + polling on send
        }

        setStatus("ready");
      } catch (e: any) {
        if (cancelled) return;
        setStatus("error");
        setError(e?.message ?? String(e));
      }
    }
    boot();
    return () => {
      cancelled = true;
      try {
        listener?.disconnect?.();
      } catch {
        // no-op
      }
    };
  }, [conversationKey]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send() {
    const text = input.trim();
    if (!text || !convId || status !== "ready" || sending) return;
    setInput("");
    setSending(true);
    const optimistic: Msg = {
      id: `tmp-${Date.now()}`,
      authorIsBot: false,
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const client = await getChatClient()!;
      await client.createMessage({
        conversationId: convId,
        payload: { type: "text", text },
      } as any);
      // Pull bot reply if listener didn't deliver within 3s
      window.setTimeout(async () => {
        try {
          const { messages: latest } = await client.listMessages({
            conversationId: convId,
          } as any);
          setMessages(
            (latest as any[])
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime(),
              )
              .map(toMsg),
          );
        } catch {
          // ignore
        }
      }, 3000);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  }

  const meName = me?.displayName ?? "You";
  const meInitials = initials(meName);

  return (
    <section className="cp">
      <header className="cp-header">
        <span className="cp-logo" aria-hidden>
          🌡️
        </span>
        <div className="cp-header-meta">
          <strong className="cp-title">PeerTemp</strong>
          <span className="cp-subtitle">
            Private 1:1 · {conversationId ?? "lobby"}
          </span>
        </div>
        <span className={`cp-status cp-status--${status}`}>
          <span className="cp-status-dot" />
          {status === "ready"
            ? "Live"
            : status === "connecting"
              ? "Connecting…"
              : status === "error"
                ? "Offline"
                : "Idle"}
        </span>
      </header>

      <div ref={scrollerRef} className="cp-feed">
        {status === "connecting" && (
          <div className="cp-empty">Connecting to PeerTemp…</div>
        )}
        {status === "error" && (
          <div className="cp-error">{error ?? "Unable to connect."}</div>
        )}
        {status === "ready" && messages.length === 0 && (
          <div className="cp-empty">
            Say hi to start — PeerTemp will walk you through consent on the
            first message.
          </div>
        )}
        {messages.map((m) => (
          <Bubble
            key={m.id}
            msg={m}
            meName={meName}
            meInitials={meInitials}
          />
        ))}
      </div>

      <footer className="cp-footer">
        <textarea
          className="cp-input"
          placeholder={
            status === "ready"
              ? "Type a message… (Enter to send · Shift+Enter for newline)"
              : "Connecting…"
          }
          value={input}
          rows={1}
          onChange={(e) => {
            setInput(e.target.value);
            const el = e.target as HTMLTextAreaElement;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={status !== "ready"}
        />
        <button
          className="cp-send"
          onClick={send}
          disabled={status !== "ready" || sending || !input.trim()}
          title="Send (Enter)"
          aria-label="Send"
        >
          {sending ? "…" : "→"}
        </button>
      </footer>
    </section>
  );
}

function toMsg(raw: any): Msg {
  const userId = raw?.userId ?? raw?.user?.id ?? raw?.authorId;
  const text =
    typeof raw?.payload?.text === "string"
      ? raw.payload.text
      : typeof raw?.payload === "string"
        ? raw.payload
        : JSON.stringify(raw?.payload ?? "").slice(0, 500);
  return {
    id: String(raw?.id ?? raw?.messageId ?? Math.random()),
    authorIsBot: !userId || raw?.isBot === true || /bot/i.test(String(userId)),
    text,
    createdAt: raw?.createdAt ?? new Date().toISOString(),
  };
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

function Bubble({
  msg,
  meName,
  meInitials,
}: {
  msg: Msg;
  meName: string;
  meInitials: string;
}) {
  const isBot = msg.authorIsBot;
  const time = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`cp-msg ${isBot ? "cp-msg--bot" : "cp-msg--me"}`}>
      <div className="cp-msg-avatar" aria-hidden>
        {isBot ? "🌡️" : meInitials}
      </div>
      <div className="cp-msg-body">
        <div className="cp-msg-meta">
          <strong>{isBot ? "PeerTemp" : meName}</strong>
          <span className="cp-msg-time">{time}</span>
        </div>
        <div className="cp-msg-bubble">{msg.text}</div>
      </div>
    </div>
  );
}
