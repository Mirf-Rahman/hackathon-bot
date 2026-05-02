import { Client, type AuthenticatedClient } from "@botpress/chat";
import { env } from "./env";

/**
 * The Botpress chat SDK identifies callers via a JWT ("userKey"). On first
 * connect we mint a stable userId, the API returns the signed JWT, and we
 * cache it so consent + temperature persist across reloads. Older SDK
 * versions of this app stored a UUID under USER_KEY by mistake — detect
 * that (non-JWT) and migrate.
 */
const USER_ID_KEY = "peertemp.chat.userId";
const USER_JWT_KEY = "peertemp.chat.userJwt";

function isJwt(s: string | null): s is string {
  return !!s && s.split(".").length === 3;
}

function getOrCreateUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = `peertemp-${crypto.randomUUID()}`;
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

let clientPromise: Promise<AuthenticatedClient> | null = null;
let cachedJwt: string | null = null;

export function getStoredJwt(): string | null {
  return cachedJwt;
}

export function getChatClient(): Promise<AuthenticatedClient> | null {
  if (!env.chatApiUrl) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      const userId = getOrCreateUserId();
      const existing = localStorage.getItem(USER_JWT_KEY);
      try {
        const auth = isJwt(existing)
          ? await Client.connect({ apiUrl: env.chatApiUrl, userKey: existing })
          : await Client.connect({ apiUrl: env.chatApiUrl, userId });
        cachedJwt = (auth as any).user?.key ?? existing ?? null;
        if (cachedJwt) localStorage.setItem(USER_JWT_KEY, cachedJwt);
        return auth;
      } catch (e) {
        // bad cached JWT → wipe and retry once with userId
        localStorage.removeItem(USER_JWT_KEY);
        const auth = await Client.connect({
          apiUrl: env.chatApiUrl,
          userId,
        });
        cachedJwt = (auth as any).user?.key ?? null;
        if (cachedJwt) localStorage.setItem(USER_JWT_KEY, cachedJwt);
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
