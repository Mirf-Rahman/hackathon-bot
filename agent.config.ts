import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "peerTemp",
  description: "PeerTemp — temperature-ranked collaboration platform",

  defaultModels: {
    autonomous: "openai:gpt-4.1-mini-2025-04-14",
    zai: "openai:gpt-4.1-mini-2025-04-14",
  },

  bot: {
    state: z.object({
      lastCommitShaByGc: z
        .record(z.string())
        .default({})
        .describe(
          "Map of conversationId → last seen GitHub SHA, for commitPoller dedupe",
        ),
    }),
  },

  user: {
    state: z.object({
      temperature: z
        .number()
        .default(36.5)
        .describe("PeerTemp accountability score in °C"),
      hasConsented: z.boolean().default(false),
      role: z
        .enum(["admin", "leader", "member", "observer"])
        .default("member")
        .describe("Platform-level role"),
      githubLogin: z.string().optional(),
      onTimeStreak: z.number().default(0),
      lastActivityAt: z.string().optional(),
      activeOrganizationId: z.string().optional(),
      activeConversationId: z.string().optional(),
      performanceLabel: z
        .enum(["outstanding", "strong", "stable", "at_risk", "critical"])
        .default("stable"),
    }),
  },

  configuration: {
    schema: z.object({
      defaultSheetId: z
        .string()
        .optional()
        .describe(
          "Fallback Google Sheet id used by logActivity when a GC has no sheet",
        ),
      defaultSheetRange: z.string().default("Activity!A:F"),
      pollerEnabled: z.boolean().default(true),
    }),
  },

  dependencies: {
    integrations: {
      chat: "chat@1.0.0",
      webchat: "webchat@0.3.0",
      gsheets: "gsheets@2.1.9",
    },
  },
});
