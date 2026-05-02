import { create } from "zustand";
import { Client as APIClient } from "@botpress/client";
import { env } from "../lib/env";

const DEFAULT_KEY = "DEFAULT";

type ClientsState = {
  APIClients: Record<string, APIClient>;
  getAPIClient: (props?: { botId?: string; workspaceId?: string }) => APIClient;
};

export const useClientsStore = create<ClientsState>((set, get) => ({
  APIClients: {},
  getAPIClient: (props) => {
    const workspaceId = props?.workspaceId ?? env.workspaceId;
    const botId = props?.botId ?? env.botId;
    const key = botId ? `${workspaceId}-${botId}` : workspaceId || DEFAULT_KEY;

    const cached = get().APIClients[key];
    if (cached) return cached;

    const client = new APIClient({
      apiUrl: env.apiUrl,
      workspaceId,
      token: env.token,
      botId,
    } as any);

    set((s) => ({ APIClients: { ...s.APIClients, [key]: client } }));
    return client;
  },
}));

export function getApiClient() {
  return useClientsStore.getState().getAPIClient();
}
