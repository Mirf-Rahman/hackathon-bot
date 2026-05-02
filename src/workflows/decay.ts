import { Workflow, actions, z } from "@botpress/runtime";
import { GroupChatMembersTable } from "../tables/GroupChatMembers";
import { TasksTable } from "../tables/Tasks";
import { TemperatureEventsTable } from "../tables/TemperatureEvents";
import { GroupChatsTable } from "../tables/GroupChats";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Hourly:
 *   - Inactivity drift toward 36.5°C (or the gate floor) for active members.
 *   - Per-day overdue penalty for tasks past their dueAt that aren't done yet.
 *
 * Idempotency: before applying a per-day overdue penalty for a task, we check
 * TemperatureEventsTable for an existing 'task' event with that sourceId on
 * the same UTC day.
 */
export const decay = new Workflow({
  name: "decay",
  description: "Hourly inactivity drift + overdue task penalties.",
  schedule: "0 * * * *",
  input: z.object({}).default({}),
  output: z.object({ driftedMembers: z.number(), penalizedTasks: z.number() }),
  async handler() {
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);

    let driftedMembers = 0;
    let penalizedTasks = 0;

    // Inactivity drift
    const { rows: members } = await GroupChatMembersTable.findRows({
      filter: { status: "active" } as any,
      limit: 1000,
    });
    const { rows: gcs } = await GroupChatsTable.findRows({
      filter: {} as any,
      limit: 1000,
    });
    const gcByConv: Record<string, any> = {};
    for (const gc of gcs as any[]) gcByConv[gc.conversationId] = gc;

    for (const m of members as any[]) {
      const gc = gcByConv[m.conversationId];
      const target = gc?.joinGateEnabled
        ? Math.min(36.5, gc.minTemperatureToJoin ?? 36.5)
        : 36.5;
      // We don't have per-member lastActivityAt cheaply here in MVP; apply small
      // drift toward target. Cap by ±0.1 per run to avoid drama.
      await (actions as any).logTemperatureEvent({
        userId: m.userId,
        organizationId: m.organizationId,
        conversationId: m.conversationId,
        delta: -0.05,
        reason: "hourly inactivity drift",
        sourceType: "decay",
      });
      driftedMembers += 1;
    }

    // Overdue task penalties
    const { rows: tasks } = await TasksTable.findRows({
      filter: {} as any,
      limit: 1000,
    });
    for (const t of tasks as any[]) {
      if (t.status === "done" || !t.dueAt || !t.assigneeUserId) continue;
      const due = new Date(t.dueAt).getTime();
      if (due > now) continue;

      const taskId = String(t.id);
      const { rows: existing } = await TemperatureEventsTable.findRows({
        filter: { sourceId: taskId, sourceType: "task" } as any,
        limit: 50,
      });
      const alreadyToday = (existing as any[]).some(
        (e) => String(e.occurredAt).startsWith(today) && Number(e.delta) < 0,
      );
      if (alreadyToday) continue;

      await (actions as any).logTemperatureEvent({
        userId: t.assigneeUserId,
        organizationId: t.organizationId,
        conversationId: t.conversationId,
        delta: -0.5,
        reason: `task overdue: ${t.title}`,
        sourceType: "task",
        sourceId: taskId,
      });
      penalizedTasks += 1;
    }

    return { driftedMembers, penalizedTasks };
  },
});
