/// <reference path="../../../../.adk/action-types.d.ts" />
/// <reference path="../../../../.adk/table-types.d.ts" />

/**
 * If you see "Cannot find file" here, run `adk dev` (or `adk build`) once at
 * the repo root so `.adk/*.d.ts` is generated. The triple-slash refs above
 * are how PeerTemp keeps the frontend types in lockstep with the bot.
 */

export type Member = {
  userId: string;
  workRole: string;
  currentTemperature: number;
  delta7d?: number;
};

export type TemperatureEvent = {
  id?: number | string;
  userId: string;
  conversationId?: string;
  organizationId: string;
  delta: number;
  beforeValue: number;
  afterValue: number;
  reason: string;
  sourceType:
    | "task"
    | "review"
    | "commit"
    | "manual"
    | "decay"
    | "language"
    | "streak";
  occurredAt: string;
};

export type Task = {
  id?: number | string;
  conversationId: string;
  organizationId: string;
  assigneeUserId?: string;
  assigneeInferred?: boolean;
  title: string;
  status: "open" | "in_progress" | "done" | "blocked";
  difficulty?: number;
  urgency?: number;
  dueAt?: string;
  completedAt?: string;
  completedOnTime?: boolean;
};

export type Review = {
  id?: number | string;
  conversationId: string;
  organizationId: string;
  reviewerUserId: string;
  revieweeUserId: string;
  reviewType: "peer" | "leader";
  temperatureRating: number;
  justification: string;
  occurredAt: string;
};

export type GroupChat = {
  id?: number | string;
  conversationId: string;
  organizationId: string;
  title: string;
  description?: string;
  leaderUserId: string;
  status: "active" | "archived" | "closed";
  currentAvgTemperature: number;
  minTemperatureToJoin: number;
  joinGateEnabled: boolean;
  links?: { github?: string };
};

export type AuditLog = {
  id?: number | string;
  organizationId: string;
  actorUserId: string;
  action: string;
  target?: string;
  payload?: Record<string, unknown>;
  at: string;
};

export type PerformanceLabel =
  | "outstanding"
  | "strong"
  | "stable"
  | "at_risk"
  | "critical";
