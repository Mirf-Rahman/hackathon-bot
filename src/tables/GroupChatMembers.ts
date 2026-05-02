import { Table, z } from "@botpress/runtime";

export const GroupChatMembersTable = new Table({
  name: "GroupChatMembersTable",
  description: "Junction (user × group chat) carrying the per-GC work role.",
  columns: {
    conversationId: z.string(),
    organizationId: z.string(),
    userId: z.string(),
    workRole: z
      .enum([
        "project_manager",
        "developer",
        "frontend",
        "backend",
        "fullstack",
        "it_support",
        "qa",
        "designer",
        "researcher",
        "analyst",
        "devops",
        "content_writer",
        "presenter",
        "other",
      ])
      .default("other"),
    leaderFlag: z.boolean().default(false),
    joinedAt: z.string(),
    status: z.enum(["active", "removed", "left"]).default("active"),
  },
});
