import type { Role } from "../stores/authStore";

/**
 * The eight personas seeded by `seedDemoData` on the bot side. Picking one
 * from the login screen instantly inherits two weeks of temperature events,
 * tasks, reviews, and consent. The user IDs MUST match the seeder exactly
 * (`src/actions/seedDemoData.ts`) — they are the join key for everything.
 */

export type DemoPersona = {
  userId: string;
  displayName: string;
  workRole: string;
  role: Role;
  blurb: string;
  temperature: number;
};

export const DEMO_TEAM: DemoPersona[] = [
  {
    userId: "user_demo_alex",
    displayName: "Alex Park",
    workRole: "Project manager",
    role: "leader",
    blurb: "Owns Project-X · runs standups · approves join requests",
    temperature: 38.4,
  },
  {
    userId: "user_demo_sam",
    displayName: "Sam Rivera",
    workRole: "Backend engineer",
    role: "member",
    blurb: "Shipping the auth endpoint — top of the leaderboard",
    temperature: 37.6,
  },
  {
    userId: "user_demo_priya",
    displayName: "Priya Shah",
    workRole: "Frontend engineer",
    role: "member",
    blurb: "Wiring passkeys + onboarding spacing polish",
    temperature: 37.2,
  },
  {
    userId: "user_demo_jordan",
    displayName: "Jordan Lee",
    workRole: "Designer",
    role: "leader",
    blurb: "Leads Design crit · iterating on onboarding v3",
    temperature: 38.7,
  },
  {
    userId: "user_demo_casey",
    displayName: "Casey Kim",
    workRole: "QA lead",
    role: "member",
    blurb: "Edge-case hunter · drafting passkey QA plan",
    temperature: 36.9,
  },
  {
    userId: "user_demo_taylor",
    displayName: "Taylor Wu",
    workRole: "DevOps",
    role: "member",
    blurb: "Pushing SSO env vars to staging",
    temperature: 36.4,
  },
  {
    userId: "user_demo_morgan",
    displayName: "Morgan Diaz",
    workRole: "Full-stack",
    role: "member",
    blurb: "Underwater on release notes — cooler temperature",
    temperature: 35.8,
  },
  {
    userId: "user_demo_riley",
    displayName: "Riley Chen",
    workRole: "Marketing analyst",
    role: "leader",
    blurb: "Driving Q2 launch coordination",
    temperature: 37.9,
  },
];

const BY_ID = new Map(DEMO_TEAM.map((m) => [m.userId, m]));

export function lookupDemoPersona(userId: string): DemoPersona | undefined {
  return BY_ID.get(userId);
}

/**
 * Resolve a friendly label for any userId. Falls back to a truncated id when
 * the user is not part of the seeded demo team.
 */
export function resolveDisplayName(
  userId: string,
  fallbackDisplayName?: string,
): string {
  if (fallbackDisplayName && fallbackDisplayName !== userId) {
    return fallbackDisplayName;
  }
  const persona = BY_ID.get(userId);
  if (persona) return persona.displayName;
  if (userId.length <= 18) return userId;
  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}
