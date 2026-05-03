import { Client, type AuthenticatedClient } from "@botpress/chat";
import { env } from "./env";
import { useAuthStore } from "../stores/authStore";

/**
 * The Botpress chat SDK identifies callers via a JWT ("userKey"). On first
 * connect we pass the logged-in user's stable userId from the auth store, the
 * API returns the signed JWT, and we cache it so consent + temperature
 * persist across reloads.
 *
 * Anonymous browsing (no login) still works via a per-tab UUID — but the
 * normal flow is: user logs in → chat client is reset → next conversation
 * connects with that user's stable id.
 */
const ANON_ID_KEY = "peertemp.chat.userId";
const USER_JWT_KEY_PREFIX = "peertemp.chat.userJwt:";

function isJwt(s: string | null): s is string {
  return !!s && s.split(".").length === 3;
}

function getOrCreateAnonId(): string {
  let id = localStorage.getItem(ANON_ID_KEY);
  if (!id) {
    id = `peertemp-${crypto.randomUUID()}`;
    localStorage.setItem(ANON_ID_KEY, id);
  }
  return id;
}

function activeUserId(): string {
  const u = useAuthStore.getState().user;
  return u?.userId ?? getOrCreateAnonId();
}

let cachedFor: string | null = null;
let clientPromise: Promise<AuthenticatedClient> | null = null;

/** Force the client to re-handshake under a new identity. */
export function resetChatClient() {
  cachedFor = null;
  clientPromise = null;
}

// Auto-reset when the user signs in/out.
useAuthStore.subscribe((state, prev) => {
  if (state.user?.userId !== prev.user?.userId) resetChatClient();
});

export function getChatClient(): Promise<AuthenticatedClient> | null {
  if (!env.chatApiUrl) return null;
  const userId = activeUserId();
  if (!clientPromise || cachedFor !== userId) {
    cachedFor = userId;
    const jwtKey = `${USER_JWT_KEY_PREFIX}${userId}`;
    clientPromise = (async () => {
      const existing = localStorage.getItem(jwtKey);
      try {
        const auth = isJwt(existing)
          ? await Client.connect({ apiUrl: env.chatApiUrl, userKey: existing })
          : await Client.connect({ apiUrl: env.chatApiUrl, userId });
        const jwt = (auth as any).user?.key ?? existing ?? null;
        if (jwt) localStorage.setItem(jwtKey, jwt);
        return auth;
      } catch (e) {
        // bad cached JWT → wipe and retry once with userId
        localStorage.removeItem(jwtKey);
        const auth = await Client.connect({
          apiUrl: env.chatApiUrl,
          userId,
        });
        const jwt = (auth as any).user?.key ?? null;
        if (jwt) localStorage.setItem(jwtKey, jwt);
        return auth;
      }
    })();
  }
  return clientPromise;
}

export async function ensureConversation(
  externalId: string,
): Promise<{ conversationId: string; client: AuthenticatedClient }> {
  const client = await getChatClient()!;
  const { conversation } = await client.getOrCreateConversation({
    id: externalId,
  } as any);
  return { conversationId: conversation.id, client };
}
