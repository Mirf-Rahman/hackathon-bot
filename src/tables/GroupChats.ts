import { Table, z } from "@botpress/runtime";

export const GroupChatsTable = new Table({
  name: "GroupChatsTable",
  description:
    "One row per group chat (conversation). Holds settings + aggregate metrics.",
  columns: {
    conversationId: z.string().describe("Botpress conversation.id"),
    organizationId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    channel: z.string().describe("e.g. webchat.channel, chat.channel"),
    leaderUserId: z.string(),
    status: z.enum(["active", "archived", "closed"]).default("active"),

    // Aggregate metrics (refreshed by workflows)
    currentAvgTemperature: z.number().default(36.5),
    rating: z.number().default(3),

    // Settings
    minTemperatureToJoin: z
      .number()
      .default(0)
      .describe("0 = open; otherwise gate"),
    joinGateEnabled: z.boolean().default(false),
    responseTimeSlaMin: z.number().default(30),
    maxRepliesPerHour: z.number().default(20),
    languageLevel: z.enum(["formal", "casual", "informal"]).default("formal"),
    audienceAgeBand: z
      .enum(["kids", "teen", "adult", "mixed"])
      .default("adult"),

    links: z
      .object({
        github: z.string().optional().describe("owner/repo"),
        googleDoc: z.string().optional(),
        googleSheet: z.string().optional(),
        figma: z.string().optional(),
        notion: z.string().optional(),
        jira: z.string().optional(),
        ppt: z.string().optional(),
      })
      .default({}),

    reviewSchedule: z
      .enum([
        "inherit",
        "weekly",
        "monthly",
        "quarterly",
        "semester",
        "yearly",
        "manual",
      ])
      .default("inherit"),
    startedAt: z.string().optional(),
    closedAt: z.string().optional(),
  },
});
