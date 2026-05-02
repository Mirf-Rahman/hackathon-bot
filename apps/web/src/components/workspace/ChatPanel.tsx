import { useEffect, useMemo, useRef, useState } from "react";
import { env } from "../../lib/env";
import { ensureConversation, getChatClient } from "../../lib/chatClient";

type Msg = {
  id: string;
  authorIsBot: boolean;
  text: string;
  createdAt: string;
};

/**
 * Real in-app chat with the PeerTemp bot. Uses the bot's `chat` integration
 * webhook (no iframe). Each GC route gets its own conversation, mirroring
 * the platform's group-chat model. The bot's consent gate runs on first
 * message just like in the CLI.
 */
export function ChatPanel({ conversationId }: { conversationId?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
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

        // Load existing messages
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

        // Live updates via signal listener (server-sent events)
        try {
          listener = await client.listenConversation({
            id: cid,
          } as any);
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
    if (!text || !convId || status !== "ready") return;
    setInput("");
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
      setTimeout(async () => {
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
    }
  }

  return (
    <section
      className="glass card"
      style={{
        padding: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 560,
        maxHeight: "78vh",
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
        <span style={{ fontSize: 18 }}>💬</span>
        <strong style={{ flex: 1 }}>PeerTemp chat</strong>
        <span className="muted" style={{ fontSize: 12 }}>
          {status === "ready"
            ? "live"
            : status === "connecting"
              ? "connecting…"
              : status}
        </span>
      </header>

      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {status === "connecting" && (
          <div className="muted">Connecting to PeerTemp…</div>
        )}
        {status === "error" && (
          <div className="banner">{error ?? "Unable to connect."}</div>
        )}
        {status === "ready" && messages.length === 0 && (
          <div className="muted">
            Say hi to start — PeerTemp will walk you through consent on the
            first message.
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} msg={m} />
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
          placeholder={status === "ready" ? "Type a message…" : "Connecting…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={status !== "ready"}
        />
        <button
          className="btn btn-primary"
          onClick={send}
          disabled={status !== "ready" || !input.trim()}
        >
          Send
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

function Bubble({ msg }: { msg: Msg }) {
  const isBot = msg.authorIsBot;
  return (
    <div
      style={{
        alignSelf: isBot ? "flex-start" : "flex-end",
        maxWidth: "80%",
        background: isBot
          ? "rgba(124, 58, 237, 0.22)"
          : "rgba(37, 99, 235, 0.28)",
        border: "1px solid rgba(255,255,255,0.18)",
        padding: "8px 12px",
        borderRadius: 14,
        whiteSpace: "pre-wrap",
        fontSize: 14,
        lineHeight: 1.45,
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>
        {isBot ? "PeerTemp" : "you"} ·{" "}
        {new Date(msg.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
      {msg.text}
    </div>
  );
}
