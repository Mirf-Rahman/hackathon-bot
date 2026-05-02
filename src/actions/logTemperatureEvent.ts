import { Action, user, z } from "@botpress/runtime";
import { TemperatureEventsTable } from "../tables/TemperatureEvents";
import { TEMP_BASELINE, capDelta, clampTemperature } from "../lib/temperature";

/**
 * THE invariant of PeerTemp: every change to a user's temperature flows
 * through this Action. It writes a TemperatureEventsTable row AND mutates
 * `user.state.temperature`.
 *
 * MVP NOTE: `user.state` here is the *current* user (the one in context).
 * For events that affect a *different* user (peer reviews, leader adjusts on
 * someone else, github commit attribution), the caller is responsible for
 * ensuring this runs in that user's context, OR we fall back to writing
 * only the event row (the trend chart still works) and a workflow can
 * reconcile aggregate displays.
 */
export const logTemperatureEvent = new Action({
  name: "logTemperatureEvent",
  description:
    "Append a TemperatureEvent and (when the affected user matches the active user) mutate user.state.temperature.",
  input: z.object({
    userId: z.string().describe("The user whose temperature is changing"),
    organizationId: z.string(),
    conversationId: z.string().optional(),
    delta: z.number(),
    reason: z.string(),
    sourceType: z.enum([
      "task",
      "review",
      "commit",
      "manual",
      "decay",
      "language",
      "streak",
    ]),
    sourceId: z.string().optional(),
    metricWeight: z.number().optional(),
    /** When set, ignores the global per-event cap (e.g. justified manual leader override). */
    bypassCap: z.boolean().optional(),
    /** When applying decay-style drift toward a target instead of a fixed delta. */
    floor: z.number().optional(),
    ceiling: z.number().optional(),
  }),
  output: z.object({
    eventId: z.string().optional(),
    beforeValue: z.number(),
    afterValue: z.number(),
    appliedDelta: z.number(),
  }),
  async handler({ input }) {
    const cappedDelta = input.bypassCap ? input.delta : capDelta(input.delta);

    // Resolve the affected user's "before" temperature.
    // If the active user is the affected user we can read user.state directly;
    // otherwise we fall back to the baseline so we still produce a valid event.
    let beforeValue = TEMP_BASELINE;
    let isActiveUser = false;
    try {
      // user.state is only available for the active user in context.
      // Reading it for someone else throws — guard with try/catch.
      if ((user as any).id === input.userId) {
        isActiveUser = true;
        beforeValue =
          typeof user.state.temperature === "number"
            ? user.state.temperature
            : TEMP_BASELINE;
      }
    } catch {
      // not in user context — beforeValue stays at baseline
    }

    const afterValue = clampTemperature(
      beforeValue + cappedDelta,
      input.floor,
      input.ceiling,
    );

    const occurredAt = new Date().toISOString();

    const row = await TemperatureEventsTable.createRows({
      rows: [
        {
          userId: input.userId,
          organizationId: input.organizationId,
          conversationId: input.conversationId,
          delta: cappedDelta,
          beforeValue,
          afterValue,
          reason: input.reason,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          metricWeight: input.metricWeight,
          occurredAt,
        },
      ],
    });

    if (isActiveUser) {
      user.state.temperature = afterValue;
      user.state.lastActivityAt = occurredAt;
    }

    const created = (row as any)?.rows?.[0] ?? (row as any)?.[0];
    return {
      eventId: created?.id ? String(created.id) : undefined,
      beforeValue,
      afterValue,
      appliedDelta: afterValue - beforeValue,
    };
  },
});
