import { Table, z } from "@botpress/runtime";

export const TasksTable = new Table({
  name: "TasksTable",
  description: "Tasks extracted from chat or ingested from GitHub commits.",
  columns: {
    conversationId: z.string(),
    organizationId: z.string(),
    assigneeUserId: z.string().optional(),
    assigneeInferred: z
      .boolean()
      .default(false)
      .describe("True until assignee confirms ownership"),
    title: { searchable: true, schema: z.string() },
    description: { searchable: true, schema: z.string().optional() },
    confidence: z
      .number()
      .optional()
      .describe("zai extraction confidence 0..1"),
    difficulty: z.number().min(1).max(5).default(3),
    estimatedHours: z.number().optional(),
    urgency: z.number().min(1).max(5).default(3),
    dueAt: z.string().optional(),
    status: z.enum(["open", "in_progress", "done", "blocked"]).default("open"),
    completedAt: z.string().optional(),
    completedOnTime: z.boolean().optional(),
    source: z.enum(["chat", "github", "manual"]).default("chat"),
    sourceMessageId: z.string().optional(),
    sourceCommitSha: z.string().optional(),
    sourceUrl: z.string().optional(),
  },
});
