import { callAction } from "./api";

export async function configureOrganization(input: {
  organizationId: string;
  scoringWeights?: Record<string, number>;
  performanceThresholds?: Record<string, number>;
  reviewSchedule?:
    | "weekly"
    | "monthly"
    | "quarterly"
    | "semester"
    | "yearly"
    | "manual";
  rules?: string;
  rulesVersion?: string;
}) {
  return callAction<typeof input, { ok: boolean }>(
    "configureOrganization",
    input,
  );
}

export async function configureGroupChat(input: {
  conversationId: string;
  minTemperatureToJoin?: number;
  joinGateEnabled?: boolean;
  languageLevel?: "formal" | "casual" | "informal";
  links?: { github?: string };
}) {
  return callAction<typeof input, { ok: boolean }>("configureGroupChat", input);
}

export async function approveJoinRequest(joinRequestId: string) {
  return callAction<{ joinRequestId: string }, { ok: boolean }>(
    "approveJoinRequest",
    {
      joinRequestId,
    },
  );
}

export async function rejectJoinRequest(
  joinRequestId: string,
  reason?: string,
) {
  return callAction<
    { joinRequestId: string; reason?: string },
    { ok: boolean }
  >("rejectJoinRequest", { joinRequestId, reason });
}
