export const env = {
  apiUrl: import.meta.env.VITE_BOTPRESS_API_URL ?? "https://api.botpress.cloud",
  workspaceId: import.meta.env.VITE_BOTPRESS_WORKSPACE_ID ?? "",
  botId: import.meta.env.VITE_BOTPRESS_BOT_ID ?? "",
  token: import.meta.env.VITE_BOTPRESS_TOKEN ?? "",
  /** Chat integration webhook url — used by the in-app ChatPanel. */
  chatApiUrl: import.meta.env.VITE_BOTPRESS_CHAT_API_URL ?? "",
};

export function envIsConfigured(): boolean {
  return Boolean(env.workspaceId && env.botId && env.token);
}
