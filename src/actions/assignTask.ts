import { Action, actions, user, z } from "@botpress/runtime";
import { TasksTable } from "../tables/Tasks";

/**
 * Persist a task extracted from chat. Bumps the assignee's temp by +0.1
 * and writes a Sheet row.
 *
 * Tool exposure: `.asTool()` is added when this Action is passed to
 * the conversation router's `execute({ tools })` array.
 */
export const assignTask = new Action({
  name: "assignTask",
  description:
    "Persist an extracted or user-confirmed task to TasksTable and bump the assignee's temperature.",
  input: z.object({
    organizationId: z.string(),
    conversationId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    assigneeUserId: z.string().optional(),
    assigneeInferred: z.boolean().default(true),
    difficulty: z.number().min(1).max(5).default(3),
    estimatedHours: z.number().optional(),
    urgency: z.number().min(1).max(5).default(3),
    dueAt: z.string().optional(),
    confidence: z.number().optional(),
    sourceMessageId: z.string().optional(),
  }),
  output: z.object({
    taskId: z.string().optional(),
  }),
  async handler({ input }) {
    const created = await TasksTable.createRows({
      rows: [
        {
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          assigneeUserId: input.assigneeUserId,
          assigneeInferred: input.assigneeInferred,
          title: input.title,
          description: input.description,
          confidence: input.confidence,
          difficulty: input.difficulty,
          estimatedHours: input.estimatedHours,
          urgency: input.urgency,
          dueAt: input.dueAt,
          status: "open",
          completedAt: undefined,
          completedOnTime: undefined,
          source: "chat",
          sourceMessageId: input.sourceMessageId,
          sourceCommitSha: undefined,
          sourceUrl: undefined,
        },
      ],
    });
    const row = (created as any)?.rows?.[0] ?? (created as any)?.[0];
    const taskId = row?.id ? String(row.id) : undefined;

    if (input.assigneeUserId) {
      await (actions as any).logTemperatureEvent({
        userId: input.assigneeUserId,
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        delta: 0.1,
        reason: `task assigned: ${input.title}`,
        sourceType: "task",
        sourceId: taskId,
      });
    }

    await (actions as any).logActivity({
      event: "task.assigned",
      who: input.assigneeUserId ?? "(inferred)",
      what: input.title,
      conversationId: input.conversationId,
    });

    return { taskId };
  },
});
