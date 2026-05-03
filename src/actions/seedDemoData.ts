import { Action, z } from "@botpress/runtime";
import { OrganizationsTable } from "../tables/Organizations";
import { GroupChatsTable } from "../tables/GroupChats";
import { GroupChatMembersTable } from "../tables/GroupChatMembers";
import { MessagesTable } from "../tables/Messages";
import { TasksTable } from "../tables/Tasks";
import { ReviewsTable } from "../tables/Reviews";
import { TemperatureEventsTable } from "../tables/TemperatureEvents";
import { JoinRequestsTable } from "../tables/JoinRequests";
import { AuditLogsTable } from "../tables/AuditLogs";
import { ConsentRecordsTable } from "../tables/ConsentRecords";
import { ContributionEvidenceTable } from "../tables/ContributionEvidence";
import { PerformanceReportsTable } from "../tables/PerformanceReports";
import { clampTemperature, labelFromScore } from "../lib/temperature";

/**
 * Idempotent demo seeder. Creates an "Acme Inc." organization with three
 * group chats, eight members, weeks of temperature events, tasks, reviews,
 * pending join requests, and audit log rows so the dashboards look like a
 * real social platform during the demo.
 *
 * Re-running with the same input is a no-op (returns the existing orgId).
 */
export const seedDemoData = new Action({
  name: "seedDemoData",
  description:
    "Seed an Acme Inc. demo organization with realistic chats, members, tasks, reviews, and temperature history.",
  input: z.object({
    orgName: z.string().default("Acme Inc."),
    /** When true, deletes existing demo rows for this org before seeding. */
    reset: z.boolean().default(false),
  }),
  output: z.object({
    organizationId: z.string(),
    groupChatIds: z.array(z.string()),
    memberIds: z.array(z.string()),
    rowsCreated: z.number(),
  }),
  async handler({ input }) {
    let rowsCreated = 0;

    // ── 1. Find or create the org
    const { rows: existingOrgs } = await OrganizationsTable.findRows({
      filter: { name: input.orgName } as any,
      limit: 1,
    });
    let orgRow = (existingOrgs as any[])[0];

    if (orgRow && input.reset) {
      // Best-effort cleanup: delete the org row; cascading rows stay (Botpress
      // tables aren't relational) — but tests below tolerate stale data.
      await OrganizationsTable.deleteRows({ ids: [orgRow.id] } as any);
      orgRow = undefined;
    }

    if (!orgRow) {
      const created = await OrganizationsTable.createRows({
        rows: [
          {
            name: input.orgName,
            ownerUserId: "user_demo_alex",
            scoringWeights: {
              responseTime: 0.2,
              participationVolume: 0.15,
              taskCompletion: 0.2,
              professionalism: 0.1,
              platformContribution: 0.15,
              leaderEvaluation: 0.1,
              peerEvaluation: 0.1,
            },
            performanceThresholds: {
              outstanding: 0.85,
              strong: 0.7,
              stable: 0.55,
              at_risk: 0.4,
            },
            reviewSchedule: "monthly",
            reviewAnchorDate: undefined,
            rules:
              "Be respectful. Communicate decisions in writing. Cite evidence over opinion. Async-first; sync when stuck.",
            rulesVersion: "1.0",
          },
        ],
      });
      orgRow = (created as any)?.rows?.[0];
      rowsCreated += 1;
    }
    const organizationId = String(orgRow.id);

    // ── 2. Members (id = stable string so re-runs match)
    const members = [
      {
        userId: "user_demo_alex",
        name: "Alex Park",
        workRole: "project_manager",
        leaderFlag: true,
        baseTemp: 38.4,
      },
      {
        userId: "user_demo_sam",
        name: "Sam Rivera",
        workRole: "backend",
        leaderFlag: false,
        baseTemp: 37.6,
      },
      {
        userId: "user_demo_priya",
        name: "Priya Shah",
        workRole: "frontend",
        leaderFlag: false,
        baseTemp: 37.2,
      },
      {
        userId: "user_demo_jordan",
        name: "Jordan Lee",
        workRole: "designer",
        leaderFlag: false,
        baseTemp: 38.7,
      },
      {
        userId: "user_demo_casey",
        name: "Casey Kim",
        workRole: "qa",
        leaderFlag: false,
        baseTemp: 36.9,
      },
      {
        userId: "user_demo_taylor",
        name: "Taylor Wu",
        workRole: "devops",
        leaderFlag: false,
        baseTemp: 36.4,
      },
      {
        userId: "user_demo_morgan",
        name: "Morgan Diaz",
        workRole: "fullstack",
        leaderFlag: false,
        baseTemp: 35.8,
      },
      {
        userId: "user_demo_riley",
        name: "Riley Chen",
        workRole: "analyst",
        leaderFlag: false,
        baseTemp: 37.9,
      },
    ];

    // ── 3. Group chats
    const gcSeeds = [
      {
        conversationId: "gc_demo_project_x",
        title: "Project-X · Auth rebuild",
        description: "Replace legacy auth with passkey + magic-link flow.",
        leaderUserId: "user_demo_alex",
        memberIds: [
          "user_demo_alex",
          "user_demo_sam",
          "user_demo_priya",
          "user_demo_taylor",
          "user_demo_casey",
        ],
        repo: "botpress/sample-app",
        joinGate: true,
        minTemp: 36.5,
        avgTemp: 37.3,
      },
      {
        conversationId: "gc_demo_design_crit",
        title: "Design crit · Onboarding v3",
        description: "Weekly design critique for the new onboarding flow.",
        leaderUserId: "user_demo_jordan",
        memberIds: [
          "user_demo_jordan",
          "user_demo_priya",
          "user_demo_riley",
          "user_demo_alex",
        ],
        repo: undefined,
        joinGate: false,
        minTemp: 0,
        avgTemp: 38.1,
      },
      {
        conversationId: "gc_demo_marketing",
        title: "Marketing · Q2 launch",
        description: "Campaign coordination for the Q2 launch.",
        leaderUserId: "user_demo_riley",
        memberIds: ["user_demo_riley", "user_demo_jordan", "user_demo_morgan"],
        repo: undefined,
        joinGate: true,
        minTemp: 36.0,
        avgTemp: 36.7,
      },
    ];

    const groupChatIds: string[] = [];
    for (const gc of gcSeeds) {
      const { rows: existing } = await GroupChatsTable.findRows({
        filter: { conversationId: gc.conversationId } as any,
        limit: 1,
      });
      if ((existing as any[])[0]) {
        groupChatIds.push(gc.conversationId);
        continue;
      }
      await GroupChatsTable.createRows({
        rows: [
          {
            conversationId: gc.conversationId,
            organizationId,
            title: gc.title,
            description: gc.description,
            channel: "webchat.channel",
            leaderUserId: gc.leaderUserId,
            status: "active",
            currentAvgTemperature: gc.avgTemp,
            rating: 4,
            minTemperatureToJoin: gc.minTemp,
            joinGateEnabled: gc.joinGate,
            responseTimeSlaMin: 30,
            maxRepliesPerHour: 20,
            languageLevel: "formal",
            audienceAgeBand: "adult",
            links: gc.repo ? { github: gc.repo } : {},
            reviewSchedule: "inherit",
            startedAt: new Date(Date.now() - 21 * 86400_000).toISOString(),
            closedAt: undefined,
          },
        ],
      });
      rowsCreated += 1;
      groupChatIds.push(gc.conversationId);
    }

    // ── 4. Memberships (batched per GC)
    for (const gc of gcSeeds) {
      const { rows: existing } = await GroupChatMembersTable.findRows({
        filter: { conversationId: gc.conversationId } as any,
        limit: 100,
      });
      const have = new Set((existing as any[]).map((r) => r.userId));
      const toCreate = gc.memberIds
        .filter((uid) => !have.has(uid))
        .map((userId) => {
          const profile = members.find((m) => m.userId === userId)!;
          return {
            conversationId: gc.conversationId,
            organizationId,
            userId,
            workRole: profile.workRole as any,
            leaderFlag: profile.userId === gc.leaderUserId,
            joinedAt: new Date(Date.now() - 18 * 86400_000).toISOString(),
            status: "active" as const,
          };
        });
      if (toCreate.length > 0) {
        await GroupChatMembersTable.createRows({ rows: toCreate });
        rowsCreated += toCreate.length;
      }
    }

    // ── 5. Consent records (one per member, on Acme org)
    {
      const { rows: existing } = await ConsentRecordsTable.findRows({
        filter: { organizationId } as any,
        limit: 100,
      });
      const have = new Set((existing as any[]).map((r) => r.userId));
      const consentRows = members
        .filter((m) => !have.has(m.userId))
        .map((m) => ({
          organizationId,
          userId: m.userId,
          conversationId: undefined as string | undefined,
          acceptedAt: new Date(Date.now() - 17 * 86400_000).toISOString(),
          rulesVersion: "1.0",
          rulesSnapshot: "PeerTemp accountability charter — demo seed",
          channel: undefined as string | undefined,
        }));
      if (consentRows.length > 0) {
        await ConsentRecordsTable.createRows({ rows: consentRows });
        rowsCreated += consentRows.length;
      }
    }

    // ── 6. Temperature event history (~25 events per member over 14 days)
    const reasons = [
      {
        sourceType: "task",
        positive: "task completed on time: API integration",
      },
      {
        sourceType: "task",
        positive: "task completed on time: ship onboarding tooltip",
      },
      {
        sourceType: "task",
        positive: "task completed on time: refactor auth middleware",
      },
      {
        sourceType: "review",
        positive: "leader review 38.5°C: clean PR, well-tested",
      },
      {
        sourceType: "review",
        positive: "peer review 38.0°C: helpful in standup",
      },
      { sourceType: "commit", positive: "commit attributed: a3f2c91" },
      { sourceType: "streak", positive: "3 on-time tasks streak bonus" },
      { sourceType: "language", positive: "professional language streak" },
    ] as const;
    const negatives = [
      { sourceType: "decay", text: "hourly inactivity drift" },
      { sourceType: "task", text: "task overdue: ship release notes" },
      { sourceType: "language", text: "unprofessional language" },
      { sourceType: "review", text: "peer review 36.0°C: missed sync window" },
    ] as const;

    for (const m of members) {
      const memberGcIds = gcSeeds.filter((gc) =>
        gc.memberIds.includes(m.userId),
      );
      // Only seed history for members not already seeded (look for any prior event row).
      const { rows: existingEvents } = await TemperatureEventsTable.findRows({
        filter: { userId: m.userId, organizationId } as any,
        limit: 1,
      });
      if ((existingEvents as any[])[0]) continue;

      let temp = 36.5;
      const events: any[] = [];
      for (let i = 0; i < 25; i++) {
        const positiveBias = Math.max(
          0.45,
          Math.min(0.85, (m.baseTemp - 36.0) / 3),
        );
        const positive = Math.random() < positiveBias;
        const e = positive
          ? reasons[i % reasons.length]
          : negatives[i % negatives.length];
        const delta = positive
          ? 0.05 + Math.random() * 0.4
          : -(0.05 + Math.random() * 0.35);
        const before = temp;
        temp = clampTemperature(temp + delta);
        const occurredAt = new Date(
          Date.now() - 14 * 86400_000 + (i * (14 * 86400_000)) / 25,
        ).toISOString();
        const gc = memberGcIds[i % Math.max(1, memberGcIds.length)];
        events.push({
          userId: m.userId,
          organizationId,
          conversationId: gc?.conversationId,
          delta: Math.round(delta * 100) / 100,
          beforeValue: Math.round(before * 100) / 100,
          afterValue: Math.round(temp * 100) / 100,
          reason: positive ? (e as any).positive : (e as any).text,
          sourceType: e.sourceType,
          occurredAt,
          metricWeight: positive ? 0.2 : undefined,
        });
      }
      // Land final value close to the member's intended baseTemp
      const drift = m.baseTemp - temp;
      if (Math.abs(drift) > 0.05) {
        const before = temp;
        temp = clampTemperature(temp + drift);
        events.push({
          userId: m.userId,
          organizationId,
          conversationId: memberGcIds[0]?.conversationId,
          delta: Math.round(drift * 100) / 100,
          beforeValue: Math.round(before * 100) / 100,
          afterValue: Math.round(temp * 100) / 100,
          reason: "rebalance",
          sourceType: "manual",
          occurredAt: new Date(Date.now() - 86400_000).toISOString(),
        });
      }
      await TemperatureEventsTable.createRows({ rows: events });
      rowsCreated += events.length;
    }

    // ── 7. Tasks (mix of done / open / overdue)
    const taskSeeds = [
      {
        gc: "gc_demo_project_x",
        assignee: "user_demo_sam",
        title: "Ship the auth endpoint",
        difficulty: 5,
        urgency: 5,
        daysAgo: 3,
        status: "done",
        onTime: true,
      },
      {
        gc: "gc_demo_project_x",
        assignee: "user_demo_priya",
        title: "Wire passkey flow into login form",
        difficulty: 4,
        urgency: 4,
        daysAgo: 4,
        status: "done",
        onTime: true,
      },
      {
        gc: "gc_demo_project_x",
        assignee: "user_demo_taylor",
        title: "Add SSO provider env vars to staging",
        difficulty: 2,
        urgency: 3,
        daysAgo: 2,
        status: "in_progress",
      },
      {
        gc: "gc_demo_project_x",
        assignee: "user_demo_casey",
        title: "Write QA plan for passkey edge cases",
        difficulty: 3,
        urgency: 4,
        daysAgo: -1,
        status: "open",
      },
      {
        gc: "gc_demo_project_x",
        assignee: "user_demo_morgan",
        title: "Update release notes",
        difficulty: 1,
        urgency: 2,
        daysAgo: 6,
        status: "done",
        onTime: false,
      },
      {
        gc: "gc_demo_design_crit",
        assignee: "user_demo_jordan",
        title: "Polish empty-state illustrations",
        difficulty: 2,
        urgency: 2,
        daysAgo: 5,
        status: "done",
        onTime: true,
      },
      {
        gc: "gc_demo_design_crit",
        assignee: "user_demo_priya",
        title: "Implement updated onboarding spacing",
        difficulty: 3,
        urgency: 3,
        daysAgo: 1,
        status: "in_progress",
      },
      {
        gc: "gc_demo_marketing",
        assignee: "user_demo_riley",
        title: "Draft Q2 launch announcement",
        difficulty: 3,
        urgency: 4,
        daysAgo: 2,
        status: "done",
        onTime: true,
      },
      {
        gc: "gc_demo_marketing",
        assignee: "user_demo_morgan",
        title: "Coordinate landing page copy with design",
        difficulty: 2,
        urgency: 3,
        daysAgo: 4,
        status: "open",
      },
    ] as const;

    const { rows: existingTasks } = await TasksTable.findRows({
      filter: { organizationId } as any,
      limit: 1,
    });
    if (!(existingTasks as any[])[0]) {
      const taskRows = taskSeeds.map((t) => {
        const dueAt = new Date(
          Date.now() +
            (t.daysAgo > 0 ? -t.daysAgo : Math.abs(t.daysAgo)) * 86400_000,
        ).toISOString();
        const completedAt =
          t.status === "done"
            ? new Date(
                Date.now() - Math.max(0, t.daysAgo - 1) * 86400_000,
              ).toISOString()
            : undefined;
        return {
          organizationId,
          conversationId: t.gc as string,
          assigneeUserId: t.assignee as string | undefined,
          assigneeInferred: false,
          title: t.title,
          description: undefined as string | undefined,
          confidence: undefined as number | undefined,
          difficulty: t.difficulty,
          urgency: t.urgency,
          estimatedHours: t.difficulty * 2,
          dueAt,
          status: t.status as "open" | "in_progress" | "done" | "blocked",
          completedAt,
          completedOnTime: (t as any).onTime as boolean | undefined,
          source: "chat" as const,
          sourceMessageId: undefined as string | undefined,
          sourceCommitSha: undefined as string | undefined,
          sourceUrl: undefined as string | undefined,
        };
      });
      await TasksTable.createRows({ rows: taskRows });
      rowsCreated += taskRows.length;
    }

    // ── 8. Reviews (peer + leader)
    const reviewSeeds = [
      {
        gc: "gc_demo_project_x",
        reviewer: "user_demo_alex",
        reviewee: "user_demo_sam",
        type: "leader",
        rating: 38.7,
        why: "Clean implementation, proactively wrote tests, helpful in code review.",
      },
      {
        gc: "gc_demo_project_x",
        reviewer: "user_demo_priya",
        reviewee: "user_demo_sam",
        type: "peer",
        rating: 38.2,
        why: "Unblocked me twice on the passkey integration.",
      },
      {
        gc: "gc_demo_project_x",
        reviewer: "user_demo_alex",
        reviewee: "user_demo_morgan",
        type: "leader",
        rating: 35.8,
        why: "Release notes shipped late and missed two callouts. Needs to ask for help sooner.",
      },
      {
        gc: "gc_demo_design_crit",
        reviewer: "user_demo_jordan",
        reviewee: "user_demo_priya",
        type: "leader",
        rating: 38.0,
        why: "Iterated quickly on feedback and shared work-in-progress early.",
      },
      {
        gc: "gc_demo_marketing",
        reviewer: "user_demo_riley",
        reviewee: "user_demo_morgan",
        type: "leader",
        rating: 36.4,
        why: "Inconsistent attendance at the campaign sync.",
      },
    ] as const;
    const { rows: existingReviews } = await ReviewsTable.findRows({
      filter: { organizationId } as any,
      limit: 1,
    });
    if (!(existingReviews as any[])[0]) {
      const reviewRows = reviewSeeds.map((r) => ({
        organizationId,
        conversationId: r.gc as string,
        reviewerUserId: r.reviewer as string,
        revieweeUserId: r.reviewee as string,
        reviewType: r.type as "peer" | "leader",
        temperatureRating: r.rating,
        justification: r.why,
        taskId: undefined as string | undefined,
        periodStart: undefined as string | undefined,
        periodEnd: undefined as string | undefined,
        occurredAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
      }));
      await ReviewsTable.createRows({ rows: reviewRows });
      rowsCreated += reviewRows.length;
    }

    // ── 9. Pending join request — a stranger trying to join Project-X below the gate
    const { rows: existingJrs } = await JoinRequestsTable.findRows({
      filter: {
        conversationId: "gc_demo_project_x",
        userId: "user_demo_newbie",
      } as any,
      limit: 1,
    });
    if (!(existingJrs as any[])[0]) {
      await JoinRequestsTable.createRows({
        rows: [
          {
            conversationId: "gc_demo_project_x",
            organizationId,
            userId: "user_demo_newbie",
            requesterTemperature: 35.9,
            status: "pending",
            justification: "Want to help with QA — happy to start small.",
            decidedBy: undefined,
            decidedAt: undefined,
            requestedAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
          },
        ],
      });
      rowsCreated += 1;
    }

    // ── 10. Audit log entries
    const auditSeeds = [
      { action: "org.create", actor: "user_demo_alex", target: organizationId },
      {
        action: "gc.configure",
        actor: "user_demo_alex",
        target: "gc_demo_project_x",
        payload: { minTemperatureToJoin: 36.5 },
      },
      {
        action: "leader.review",
        actor: "user_demo_alex",
        target: "user_demo_sam",
        payload: { temperatureRating: 38.7 },
      },
      {
        action: "temperature.adjust",
        actor: "user_demo_alex",
        target: "user_demo_sam",
        payload: {
          delta: 0.3,
          justification: "went above scope to refactor middleware",
        },
      },
      {
        action: "join.request",
        actor: "user_demo_newbie",
        target: "gc_demo_project_x",
      },
    ];
    const { rows: existingAudit } = await AuditLogsTable.findRows({
      filter: { organizationId } as any,
      limit: 1,
    });
    if (!(existingAudit as any[])[0]) {
      const auditRows = auditSeeds.map((a) => ({
        organizationId,
        actorUserId: a.actor,
        action: a.action,
        target: a.target,
        payload: (a as any).payload ?? {},
        at: new Date(Date.now() - Math.random() * 5 * 86400_000).toISOString(),
      }));
      await AuditLogsTable.createRows({ rows: auditRows });
      rowsCreated += auditRows.length;
    }

    // ── 11. Messages — realistic group-chat scripts so the GC feed looks alive
    const { rows: existingMsgs } = await MessagesTable.findRows({
      filter: { organizationId } as any,
      limit: 5,
    });
    // Re-seed if first existing row predates the `text` column (legacy seed)
    const needsReseed =
      (existingMsgs as any[]).length > 0 &&
      !(existingMsgs as any[]).some((r) => typeof r.text === "string");
    if (needsReseed) {
      try {
        await MessagesTable.deleteRows({ organizationId } as any);
      } catch {}
    }
    if (!(existingMsgs as any[])[0] || needsReseed) {
      const nameOf = (uid: string) =>
        members.find((m) => m.userId === uid)?.name ?? uid;
      const scripts: Array<{
        gc: string;
        text: string;
        sender: string;
        tone: "professional" | "neutral" | "informal" | "unprofessional";
        meaningful: boolean;
        minutesAgo: number;
        responseToMs?: number;
      }> = [
        // gc_demo_project_x — auth refactor war room
        {
          gc: "gc_demo_project_x",
          sender: "user_demo_alex",
          tone: "professional",
          meaningful: true,
          minutesAgo: 540,
          text: "Morning all — kicking off Sprint 14. Auth refactor + passkey rollout are the two epics. Sam can you take the auth endpoint?",
        },
        {
          gc: "gc_demo_project_x",
          sender: "user_demo_sam",
          tone: "professional",
          meaningful: true,
          minutesAgo: 538,
          responseToMs: 120_000,
          text: "On it. Should land by Wed if scope holds. I'll open a draft PR for early eyes.",
        },
        {
          gc: "gc_demo_project_x",
          sender: "user_demo_priya",
          tone: "professional",
          meaningful: true,
          minutesAgo: 535,
          responseToMs: 180_000,
          text: "I'll handle the passkey button + states on the login form. Need the new endpoint stubbed to wire fetch — Sam ping me when types are ready?",
        },
        {
          gc: "gc_demo_project_x",
          sender: "user_demo_sam",
          tone: "informal",
          meaningful: false,
          minutesAgo: 533,
          responseToMs: 90_000,
          text: "yep 👍",
        },
        {
          gc: "gc_demo_project_x",
          sender: "user_demo_taylor",
          tone: "professional",
          meaningful: true,
          minutesAgo: 480,
          text: "Staging SSO env vars going in this afternoon. Will post the var names in #infra once verified.",
        },
        {
          gc: "gc_demo_project_x",
          sender: "user_demo_casey",
          tone: "professional",
          meaningful: true,
          minutesAgo: 360,
          text: "QA plan draft for passkey edge cases is up — focused on browser support matrix and lost-device recovery. Reviews welcome.",
        },
        {
          gc: "gc_demo_project_x",
          sender: "user_demo_morgan",
          tone: "unprofessional",
          meaningful: false,
          minutesAgo: 320,
          text: "lol release notes again seriously who reads these",
        },
        {
          gc: "gc_demo_project_x",
          sender: "user_demo_alex",
          tone: "professional",
          meaningful: true,
          minutesAgo: 318,
          responseToMs: 120_000,
          text: "Morgan — let's keep it constructive. Customers + support both read them. Happy to pair if the scope feels heavy.",
        },
        {
          gc: "gc_demo_project_x",
          sender: "user_demo_sam",
          tone: "professional",
          meaningful: true,
          minutesAgo: 180,
          text: "Auth endpoint shipped to staging. PR #482. Priya — types are exported from `@acme/auth-shared`.",
        },
        {
          gc: "gc_demo_project_x",
          sender: "user_demo_priya",
          tone: "informal",
          meaningful: false,
          minutesAgo: 178,
          responseToMs: 110_000,
          text: "amazing 🎉 wiring it now",
        },
        {
          gc: "gc_demo_project_x",
          sender: "user_demo_casey",
          tone: "professional",
          meaningful: true,
          minutesAgo: 90,
          text: "Found 1 edge case: expired magic link silently 200s instead of 410. Filing now.",
        },
        {
          gc: "gc_demo_project_x",
          sender: "user_demo_sam",
          tone: "professional",
          meaningful: true,
          minutesAgo: 85,
          responseToMs: 300_000,
          text: "Good catch — pushing fix.",
        },
        {
          gc: "gc_demo_project_x",
          sender: "user_demo_alex",
          tone: "professional",
          meaningful: true,
          minutesAgo: 30,
          text: "Standup in 5 — quick async if you can't join: blockers + ETA only.",
        },

        // gc_demo_design_crit — design crit
        {
          gc: "gc_demo_design_crit",
          sender: "user_demo_jordan",
          tone: "professional",
          meaningful: true,
          minutesAgo: 1440,
          text: 'New empty-state illustrations are in Figma → "Onboarding v3". Looking for crit on the second variant especially.',
        },
        {
          gc: "gc_demo_design_crit",
          sender: "user_demo_priya",
          tone: "professional",
          meaningful: true,
          minutesAgo: 1380,
          responseToMs: 600_000,
          text: 'Variant 2 reads better at small sizes. The microcopy under it could be tighter though — "Nothing here yet" is doing more work than the illustration.',
        },
        {
          gc: "gc_demo_design_crit",
          sender: "user_demo_alex",
          tone: "professional",
          meaningful: true,
          minutesAgo: 1200,
          text: "Agree with Priya. Also +1 to variant 2. Can we ship this with the v3 onboarding milestone?",
        },
        {
          gc: "gc_demo_design_crit",
          sender: "user_demo_jordan",
          tone: "professional",
          meaningful: true,
          minutesAgo: 1180,
          responseToMs: 240_000,
          text: "Yes — I'll have export-ready assets by EOD tomorrow.",
        },
        {
          gc: "gc_demo_design_crit",
          sender: "user_demo_riley",
          tone: "neutral",
          meaningful: true,
          minutesAgo: 600,
          text: "Heads up: I'm pulling onboarding funnel numbers Friday — happy to A/B once shipped.",
        },

        // gc_demo_marketing — Q2 launch
        {
          gc: "gc_demo_marketing",
          sender: "user_demo_riley",
          tone: "professional",
          meaningful: true,
          minutesAgo: 720,
          text: "Q2 launch announcement draft is in the doc. Need copy review by Thu — calling out @morgan for landing page coordination.",
        },
        {
          gc: "gc_demo_marketing",
          sender: "user_demo_jordan",
          tone: "professional",
          meaningful: true,
          minutesAgo: 700,
          responseToMs: 180_000,
          text: "Reading now. The hero section feature list is great, second half feels long — could lose 2 paragraphs.",
        },
        {
          gc: "gc_demo_marketing",
          sender: "user_demo_morgan",
          tone: "informal",
          meaningful: false,
          minutesAgo: 480,
          text: "k will look later",
        },
        {
          gc: "gc_demo_marketing",
          sender: "user_demo_riley",
          tone: "professional",
          meaningful: true,
          minutesAgo: 240,
          text: "Morgan — Thu deadline is firm. If capacity is the issue let me know and I'll re-route.",
        },
      ];

      const messageRows = scripts.map((s) => ({
        conversationId: s.gc,
        organizationId,
        senderUserId: s.sender,
        senderDisplayName: nameOf(s.sender),
        text: s.text,
        postedAt: new Date(Date.now() - s.minutesAgo * 60_000).toISOString(),
        professionalism: s.tone,
        meaningful: s.meaningful,
        responseToMs: s.responseToMs,
      }));
      await MessagesTable.createRows({ rows: messageRows });
      rowsCreated += messageRows.length;
    }

    // ── 12. Contribution evidence — a few github commit links
    const { rows: existingEv } = await ContributionEvidenceTable.findRows({
      filter: { organizationId } as any,
      limit: 1,
    });
    if (!(existingEv as any[])[0]) {
      const evidences = [
        {
          user: "user_demo_sam",
          sha: "a3f2c91",
          title: "feat(auth): swap legacy middleware",
        },
        {
          user: "user_demo_sam",
          sha: "b71ef0d",
          title: "fix(auth): handle expired magic link",
        },
        {
          user: "user_demo_priya",
          sha: "4e9aa12",
          title: "feat(login): passkey button + states",
        },
        {
          user: "user_demo_taylor",
          sha: "c0fe317",
          title: "chore(infra): SSO env vars in staging",
        },
      ];
      const evRows = evidences.map((e) => ({
        organizationId,
        conversationId: "gc_demo_project_x",
        userId: e.user,
        kind: "github_commit" as const,
        url: `https://github.com/botpress/sample-app/commit/${e.sha}`,
        title: e.title,
        occurredAt: new Date(
          Date.now() - Math.random() * 7 * 86400_000,
        ).toISOString(),
        notes: "demo seed",
      }));
      await ContributionEvidenceTable.createRows({ rows: evRows });
      rowsCreated += evRows.length;
    }

    // ── 13. One ready-made performance report so the Reviews tab isn't empty
    const { rows: existingReports } = await PerformanceReportsTable.findRows({
      filter: { organizationId } as any,
      limit: 1,
    });
    if (!(existingReports as any[])[0]) {
      const score = 0.78;
      await PerformanceReportsTable.createRows({
        rows: [
          {
            organizationId,
            conversationId: "gc_demo_project_x",
            userId: "user_demo_sam",
            period: "monthly",
            periodStart: new Date(Date.now() - 30 * 86400_000).toISOString(),
            periodEnd: new Date().toISOString(),
            startTemperature: 36.5,
            endTemperature: 37.6,
            label: labelFromScore(score),
            score,
            metrics: {},
            markdown:
              `# Performance Review — Sam Rivera\n\n` +
              `**Period:** monthly · **Label:** STRONG · Score 78/100\n\n` +
              `**Temperature:** 36.5°C → 37.6°C\n\n` +
              `## Summary\nSam shipped the auth endpoint on time, picked up two unblocking ` +
              `tasks for Priya, and maintained a professional tone in code review. Recommend ` +
              `nominating for the next stretch project.`,
            generatedAt: new Date().toISOString(),
          },
        ],
      });
      rowsCreated += 1;
    }

    return {
      organizationId,
      groupChatIds,
      memberIds: members.map((m) => m.userId),
      rowsCreated,
    };
  },
});
