import { Action, actions, user, z } from "@botpress/runtime";
import { TasksTable } from "../tables/Tasks";

/**
 * Mark a task as done, applying the deadline economy:
 *   on time:  +0.5 × (urgency/5) × (difficulty/5)
 *   late:     +0.1
 * Plus a +0.3 streak bonus when the assignee has 3 consecutive on-time tasks.
 */
export const completeTask = new Action({
  name: "completeTask",
  description:
    "Mark a task as done and apply the on-time/late temperature delta.",
  input: z.object({
    taskId: z.string(),
    /** Optional override; defaults to "now". */
    completedAt: z.string().optional(),
  }),
  output: z.object({
    completedOnTime: z.boolean(),
    delta: z.number(),
  }),
  async handler({ input }) {
    const id = Number(input.taskId);
    const task = await TasksTable.getRow({ id } as any);
    if (!task) throw new Error(`Task ${input.taskId} not found`);

    const completedAt = input.completedAt ?? new Date().toISOString();
    const onTime = task.dueAt
      ? new Date(completedAt).getTime() <= new Date(task.dueAt).getTime()
      : true;

    await TasksTable.updateRows({
      rows: [
        {
          id,
          status: "done",
          completedAt,
          completedOnTime: onTime,
        } as any,
      ],
    });

    let delta = onTime
      ? 0.5 * ((task.urgency ?? 3) / 5) * ((task.difficulty ?? 3) / 5)
      : 0.1;
    delta = Math.round(delta * 100) / 100;

    let streakBonus = 0;
    if (task.assigneeUserId) {
      try {
        if ((user as any).id === task.assigneeUserId) {
          const next = onTime ? (user.state.onTimeStreak ?? 0) + 1 : 0;
          user.state.onTimeStreak = next;
          if (next > 0 && next % 3 === 0) streakBonus = 0.3;
        }
      } catch {
        // streak only tracked for the active user
      }

      await (actions as any).logTemperatureEvent({
        userId: task.assigneeUserId,
        organizationId: task.organizationId,
        conversationId: task.conversationId,
        delta: delta + streakBonus,
        reason: onTime
          ? `task completed on time: ${task.title}${streakBonus ? " (streak bonus)" : ""}`
          : `task completed late: ${task.title}`,
        sourceType: "task",
        sourceId: input.taskId,
      });
    }

    await (actions as any).logActivity({
      event: onTime ? "task.completed_on_time" : "task.completed_late",
      who: task.assigneeUserId ?? "unknown",
      what: task.title,
      conversationId: task.conversationId,
    });

    return { completedOnTime: onTime, delta: delta + streakBonus };
  },
});
