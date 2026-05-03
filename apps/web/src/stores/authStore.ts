import { create } from "zustand";

/**
 * Local-only "login" for the PeerTemp demo: we capture a stable identity in
 * localStorage and use it as:
 *   - the Botpress chat client `userId` (so consent + temperature persist),
 *   - the GroupChatFeed sender,
 *   - the badge in the sidebar.
 *
 * NOTE: this is not a real auth system. Every action call from the SPA still
 * uses the workspace PAT under the hood (see clientsStore). For production
 * you'd swap this for cookie auth — see docs/adk-frontend/authentication.
 */

export type Role = "admin" | "leader" | "member" | "observer";

export type AuthUser = {
  /** Stable id used by the Botpress chat user JWT. */
  userId: string;
  displayName: string;
  email?: string;
  role: Role;
  /** When set, the user picked a seeded demo persona (rich history). */
  demoPersona?: string;
};

const STORAGE_KEY = "peertemp.auth.user";

function readPersisted(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId || !parsed?.displayName) return null;
    return parsed as AuthUser;
  } catch {
    return null;
  }
}

function writePersisted(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage may be unavailable in private mode — ignore
  }
}

type AuthState = {
  user: AuthUser | null;
  signIn: (user: AuthUser) => void;
  signOut: () => void;
  updateRole: (role: Role) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: readPersisted(),
  signIn: (user) => {
    writePersisted(user);
    set({ user });
  },
  signOut: () => {
    writePersisted(null);
    // Wipe the chat JWT too so the next login mints a fresh one for the new id.
    try {
      localStorage.removeItem("peertemp.chat.userId");
      localStorage.removeItem("peertemp.chat.userJwt");
    } catch {
      // ignore
    }
    set({ user: null });
  },
  updateRole: (role) =>
    set((s) => {
      if (!s.user) return s;
      const next = { ...s.user, role };
      writePersisted(next);
      return { user: next };
    }),
}));

/** Convenience hook — most components only need the user object. */
export function useAuthUser(): AuthUser | null {
  return useAuthStore((s) => s.user);
}
