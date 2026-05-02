import { callAction } from "./api";

export async function generateReport(input: {
  organizationId: string;
  conversationId?: string;
  userId: string;
  period: "weekly" | "monthly" | "quarterly" | "semester" | "yearly" | "custom";
  periodStart: string;
  periodEnd: string;
}) {
  return callAction<
    typeof input,
    { label: string; score: number; markdown: string }
  >("generatePerformanceReport", input);
}

export async function adjustTemperature(input: {
  organizationId: string;
  targetUserId: string;
  delta: number;
  justification: string;
  conversationId?: string;
}) {
  return callAction<
    typeof input,
    { ok: boolean; beforeValue: number; afterValue: number }
  >("adjustTemperature", input);
}
