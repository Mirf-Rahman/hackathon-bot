import { callAction } from "./api";
import type { GroupChat, AuditLog, Member } from "../types";

export type OrgDashboardBundle = {
  groupChats: GroupChat[];
  auditLogs: AuditLog[];
  topMembers: Array<{
    userId: string;
    currentTemperature: number;
    conversationId: string;
  }>;
};

export async function fetchOrgDashboard(
  organizationId: string,
): Promise<OrgDashboardBundle> {
  return callAction<{ organizationId: string }, OrgDashboardBundle>(
    "getOrgDashboardBundle",
    { organizationId },
  );
}

export async function fetchLeaderboard(
  conversationId: string,
): Promise<Member[]> {
  const res = await callAction<
    { conversationId: string },
    { members: Member[] }
  >("listLeaderboard", { conversationId });
  return res.members;
}
