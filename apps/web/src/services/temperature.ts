import { callAction } from "./api";

export type LogTemperatureEventInput = {
  userId: string;
  organizationId: string;
  conversationId?: string;
  delta: number;
  reason: string;
  sourceType:
    | "task"
    | "review"
    | "commit"
    | "manual"
    | "decay"
    | "language"
    | "streak";
  sourceId?: string;
  metricWeight?: number;
};

export type LogTemperatureEventResult = {
  eventId?: string;
  beforeValue: number;
  afterValue: number;
  appliedDelta: number;
};

/**
 * Append a TemperatureEvent for `userId`. Drives the live leaderboard +
 * member trend chart. The bot's per-event cap still applies.
 */
export async function logTemperatureEvent(
  input: LogTemperatureEventInput,
): Promise<LogTemperatureEventResult> {
  return callAction<LogTemperatureEventInput, LogTemperatureEventResult>(
    "logTemperatureEvent",
    input,
  );
}
