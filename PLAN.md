# PeerTemp — Build Plan

> **PeerTemp** is a temperature-ranked collaboration platform. Multi-org SaaS where every member carries a measurable accountability score (°C), updated by communication, contribution, and peer/leader signals. Built as a **Botpress ADK** bot (single source of truth) + **ADK-integrated** companion frontend per the [`adk-frontend`](.claude/skills/adk-frontend/SKILL.md) skill.

## Product vision

A serious accountability platform — Microsoft Teams meets a performance-review system. Organizations host group chats; group chats track tasks, conversations, and contributions; every member's **temperature** moves up or down based on measurable signals (responsiveness, task completion, peer reviews, integration activity, language professionalism). At any time a leader can pull a per-member or per-GC report; at period close, the system generates a structured performance review.

Baseline 36.5°C, range [35.0, 40.0+]. Group chats can gate entry by minimum temperature.

## Architecture: bot + frontend

The product splits into two deployables, both lived in this repo:

| Layer                        | What                                                                                                                                                        | Where                                                                                                   | Skill          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------- |
| **Bot (this repo, ADK)**     | Tables (the source of truth), Actions (mutations + scoring), Workflows (cron + audits), Conversation router (in-chat task/review extraction), Webchat embed | `/Users/aminebaha/hackathon-bot/` (current root)                                                        | `adk`          |
| **Frontend (companion app)** | Org Dashboard, GC Workspace shell, Member Profile, Review Center, Admin Settings — **Actions as API**, **Tables as DB** via `@botpress/client`              | `apps/web/` (Vite + React; see [Frontend architecture](#peertemp-frontend-architecture-adk-integrated)) | `adk-frontend` |

Webchat embeds inside the **GC Workspace** screen; the other four screens are pure data views over the bot's tables and Actions.

## Repo state (2026-05-02)

Path: `/Users/aminebaha/hackathon-bot/`. Each primitive directory holds a single commented-out `index.ts` placeholder; `agent.config.ts` is the default skeleton; no `node_modules`, no `.adk/` types yet — `npm install && adk dev` must run once before TypeScript will resolve. No `apps/web/` directory yet (scaffold per [Frontend architecture](#peertemp-frontend-architecture-adk-integrated)).

## Cursor: Botpress ADK MCP setup (IDE tooling, not production bot code)

The ADK ships a **built-in MCP server** so Cursor can call project-aware tools (traces, dev logs, test messages, integrations discovery, docs search, workflows, etc.). Reference: [`adk` skill → mcp-server.md](.claude/skills/adk/references/mcp-server.md).

**Goal here:** add Cursor config only. You do **not** need a working MCP “green light” in Settings to keep building; messaging-related MCP tools need a running dev server later.

### One-shot init (preferred)

From this repo root (directory that contains `agent.config.ts`):

```bash
cd /Users/aminebaha/hackathon-bot
adk mcp:init --tool cursor
# or generate Claude + VS Code + Cursor at once:
adk mcp:init --all
```

- Writes **project-local** [`.cursor/mcp.json`](.cursor/mcp.json) (add that path to `.gitignore` if it embeds secrets — usually it only references `adk mcp`; confirm after generation).
- If the file already exists and you want to overwrite: `adk mcp:init --tool cursor --force`.

### Monorepo variant

If the ADK bot ever moves to a subfolder (e.g. `./bot/`):

```bash
adk mcp:init --tool cursor --project-dir ./bot
```

Generated `args` typically include `--cwd` pointing at that subdirectory.

### After init (when you want tools to actually work)

| Need                                         | Action                                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| ADK CLI on PATH                              | Install Botpress ADK globally or use the same shell Cursor uses for MCP                                                |
| Cloud-linked project commands                | `adk login` or `adk login --token "$BOTPRESS_TOKEN"` (see skill note: avoid interactive hang in automation)            |
| Dev-server-backed tools (chat/workflow test) | Run `adk dev` — MCP assumes **console** `http://localhost:3001` unless you align ports (`adk dev --port-console 3001`) |
| Webchat/chat integration errors from MCP     | `adk add chat` / `adk add webchat` as needed                                                                           |

### Manual fallback (if you skip `mcp:init`)

Create `.cursor/mcp.json` at repo root:

```json
{
  "mcpServers": {
    "adk": {
      "command": "adk",
      "args": ["mcp"]
    }
  }
}
```

If Cursor still can’t spawn `adk`, use the **absolute path** to the `adk` binary in `command`, or wrap with `npx`/`pnpm exec` per your install method.

### Verify in Cursor

**Settings → MCP** (or equivalent): the `adk` server should appear. **Fully “connected”** may require a valid project + CLI + sometimes `adk dev` for specific tools.

### Debug MCP server in isolation

```bash
npx @modelcontextprotocol/inspector adk mcp
```

**Known caveat (from skill):** `adk_init_project` and similar MCP tools can still hit **interactive** login/link flows; for repeatable setup prefer **CLI**: `adk login --token …`, `adk init … --yes --skip-link`, etc.

## Pre-flight (verify against installed ADK skills before coding)

`skills-lock.json`: `adk`, `adk-integrations`, `adk-evals`, `adk-frontend`, `adk-debugger`, `adk-docs`, `adk-dev-console`. Confirm these against the skills before writing files; skill wins over plan.

| Assumption                                                                                                                               | Verify via                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Tools = `Action` + `.asTool()` (per [src/actions/index.ts](src/actions/index.ts) placeholder) vs. a separate `Autonomous.Tool` primitive | `adk` skill                                        |
| Workflows accept `schedule: '<cron>'` vs. cron lives in `src/triggers/`                                                                  | `adk` skill                                        |
| `user.state.x = …` direct mutation vs. a setter                                                                                          | `adk` skill                                        |
| `@botpress/runtime` exports `actions`, `configuration`, `user`, `bot`, `adk.zai`                                                         | `adk` skill                                        |
| Webchat custom CSS field name (`customStyles`?)                                                                                          | `adk-integrations`, `adk info webchat`             |
| Pinned versions for `chat`, `webchat`, `gsheets`                                                                                         | `adk info <name>`                                  |
| Frontend scaffolding: project layout, type-gen, auth between frontend ↔ bot                                                              | `adk-frontend` skill                               |
| `findTableRows` / table query filter shape matches current `@botpress/client`                                                            | `adk-frontend` `botpress-client.md`, runtime types |
| **Consent** must gate `MessagesTable` writes + metric loops until auditable consent exists                                               | This plan §Consent-first onboarding                |

## MVP / Stretch cut

| Feature                                                                         |                 MVP                 | Stretch |
| ------------------------------------------------------------------------------- | :---------------------------------: | :-----: |
| Organizations + GCs + Members hierarchy                                         |                 ✅                  |         |
| Roles enum + per-role evaluation hints                                          |                 ✅                  |         |
| Temperature with on-time / urgency / difficulty math                            |                 ✅                  |         |
| Temperature event log + trend chart                                             |                 ✅                  |         |
| Peer reviews as °C ratings                                                      |                 ✅                  |         |
| Leader manual temp adjust w/ justification                                      |                 ✅                  |         |
| Public-GitHub commit poller                                                     |                 ✅                  |         |
| Google Sheets activity log                                                      |                 ✅                  |         |
| Language professionalism scoring (zai-driven)                                   |                 ✅                  |         |
| Min-temperature join gate                                                       |                 ✅                  |         |
| Performance review generation (weekly/monthly/yearly/custom)                    |                 ✅                  |         |
| Configurable scoring weights per org                                            |                 ✅                  |         |
| Audit log entity + read views                                                   |                 ✅                  |         |
| Frontend: Org Dashboard + GC Workspace (with embedded webchat) + Member Profile |                 ✅                  |         |
| Frontend: Review Center + Admin Settings                                        | ✅ (ADK-integrated; Actions as API) |         |
| Integrations beyond GitHub + Sheets (Notion, Figma, Jira, Google Docs/Slides)   |                                     |   ✅    |
| Real-time messaging UI outside webchat (custom chat surface)                    |                                     |   ✅    |
| Export reports (PDF/CSV)                                                        |                                     |   ✅    |
| Cross-org leaderboards                                                          |                                     |   ✅    |
| **Projects** between org and GC (full PRD hierarchy)                            |                                     |   ✅    |
| **ConsentRecordsTable** + rules PDF/HTML export                                 |                 ✅                  |         |
| **Multi-scope temperature** snapshots (org / project / GC rollups)              |                                     |   ✅    |

## Non-functional requirements (MVP)

- **Type safety:** strict TS in bot + `apps/web`; shared intent via ADK-generated `.adk/*.d.ts` + triple-slash refs in the UI.
- **Auditability:** every temperature delta has a `TemperatureEventsTable` row; leader/admin mutations hit `AuditLogsTable`; consent is append-only in `ConsentRecordsTable`.
- **Latency:** UI dashboards tolerate 10–60s polling; **Zai**-heavy actions (`generatePerformanceReport`) use extended client timeout where the skill allows.
- **Accessibility:** temperature status is **text + color** (not color-only); charts have accessible labels; focus order in workspace (nav → content → chat).
- **Security:** no PAT in client bundles — `VITE_*` only for **public** bot/workspace IDs if needed; tokens from cookies (prod) or local env (dev) per `adk-frontend` `authentication.md`.

## Domain model

```
OrganizationsTable          (1)        — admin-owned tenant; holds scoring weights + integration creds
   └─ GroupChatsTable       (n per org; settings + min-temp gate + leader)   ← MVP: GCs hang directly off org
   [Stretch: ProjectsTable  (n per org) → GroupChatsTable scoped by projectId]
        ├─ GroupChatMembersTable  (n; user × GC × role × manualAdjust)
        ├─ TasksTable             (n; difficulty/hours/urgency/dueAt)
        ├─ MessagesTable          (n; for response-time + professionalism scoring)  *MVP=just timestamps; Stretch=full content*
        ├─ ReviewsTable           (n; peer °C ratings + leader °C ratings)
        ├─ JoinRequestsTable      (n; pending approvals when below min-temp)
        └─ TemperatureEventsTable (n; every Δ ever; the trend chart's source)

OrganizationsTable
   └─ AuditLogsTable               (n; who did what, when, why)
   └─ IntegrationConnectionsTable  (n; per-org GitHub/GDocs/etc. config)
   └─ PerformanceReportsTable      (n; generated period reviews)
   └─ ConsentRecordsTable          (n; **legal / audit trail** — see Consent-first onboarding)

users (cross-cutting)
   └─ user.state: {
        temperature,              // primary display = **chat-scoped** working temp for MVP (see Multi-scope temperature)
        hasConsented,
        activeOrganizationId?,  // **UI + router context** — set after onboarding
        activeConversationId?,    // current GC (conversation.id)
        role, githubLogin, onTimeStreak, lastActivityAt, performanceLabel
      }
```

### Multi-scope temperature (model now, full rollups = Stretch)

| Scope                     | MVP behavior                                                                              | Storage                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Global / user default** | Same as chat-scoped until Stretch                                                         | `user.state.temperature` or derived                                                        |
| **Per org**               | Optional: mean of members’ temps — **compute in Action** `getOrgDashboardBundle`          | computed, not stored                                                                       |
| **Per GC (conversation)** | **Source of truth for leaderboard** — events keyed by `conversationId` + `organizationId` | `TemperatureEventsTable`, `GroupChatsTable.currentAvgTemperature` updated by cron/workflow |
| **Per project**           | Only when `ProjectsTable` exists                                                          | Stretch: `projectId` on events + snapshot table                                            |

**Invariant (MVP):** `logTemperatureEvent` always writes `organizationId` + `conversationId` (when applicable) so the frontend can filter series and the org dashboard can aggregate.

### Consent-first onboarding (required)

Tracking and **professionalism scoring on message content** must **not** run until the member has an auditable consent record for that **organization** (and optionally GC).

1. **Workflow `onboarding`** presents summarized rules (from `generateRulesDocument` Action or static template merged with `OrganizationsTable.rules`).
2. User accepts → write **`ConsentRecordsTable`**: `{ organizationId, conversationId?, userId, acceptedAt, rulesVersion, rulesHash or snapshotText, ipUserAgent? placeholder }` and set `user.state.hasConsented = true`.
3. Until consent: router may greet but **does not** call `scoreLanguage` on full text for scoring, **does not** insert `MessagesTable` for metrics, **does not** run task extraction that persists tasks (demo mode: allow read-only help).
4. **Rules document** Action (`generateRulesDocument`) inputs org + GC settings → Markdown; stored on GC or org for display in Admin + Review Center footer.

## Workflow catalog (maps to PRD §22)

| #   | Workflow                              | Purpose                                                  | Trigger                            |
| --- | ------------------------------------- | -------------------------------------------------------- | ---------------------------------- |
| 1   | `onboarding`                          | Org/GC selection, role, **consent gate**                 | `Conversation` / `start`           |
| 2   | `consentRenewal` _(optional)_         | Re-accept when `rulesVersion` bumps                      | admin bump or scheduled            |
| 3   | `taskExtractionPipeline` _(sub-flow)_ | Confirm inferred assignee vs user confirmation           | after `extractTask` low confidence |
| 4   | `reviewCollection`                    | Remind leaders for pending join reviews / review windows | cron or manual                     |
| 5   | `temperatureReconcile` _(optional)_   | Nightly clamp + sanity check sums                        | cron                               |
| 6   | `performanceReviewBatch`              | Same as `scheduledReview` — batch generate reports       | cron                               |
| 7   | `professorAudit` / `managerAudit`     | `projectAudit` expanded — evidence package per member    | `closeProject` or manual           |
| 8   | `joinRequest`                         | SLA reminders to leader                                  | on `JoinRequestsTable` insert      |

**Note:** For MVP, several can be **phases inside** `onboarding.ts` + `scheduledReview.ts` rather than separate files; split when complexity grows.

## Tool / Action catalog (required vs MVP helpers)

**AI-callable tools** (`.asTool()` or `Autonomous.Tool` per pre-flight): assignTask, completeTask, submitPeerReview, submitLeaderReview, adjustTemperature, requestJoinGroupChat, approveJoinRequest, rejectJoinRequest, checkRepo, configureGroupChat, configureOrganization, closeProject.

**Internal / UI-callable Actions** (may or may not be tools): `logTemperatureEvent`, `logAudit`, `logActivity`, `fetchCommits`, `scoreLanguage`, `extractTask`, `computeMetrics`, `generatePerformanceReport`, **`generateRulesDocument`**, **`ingestEvidence`** (manual link + normalized row), **`getOrgDashboardBundle`**, **`getMemberProfile`**, **`listLeaderboard`**.

**PeerTemp PRD “tools” naming alignment:**

| PRD name                 | Implementation                                                     |
| ------------------------ | ------------------------------------------------------------------ |
| Task extraction tool     | `extractTask` + `assignTask`                                       |
| Professionalism analysis | `scoreLanguage`                                                    |
| Rule document generation | `generateRulesDocument`                                            |
| Temperature scoring      | `logTemperatureEvent` (+ callers only)                             |
| Review summary           | `generatePerformanceReport`                                        |
| Audit report             | `generatePerformanceReport` + `projectAudit` workflow              |
| Evidence normalization   | `ingestEvidence` → `ContributionEvidenceTable` _(new table below)_ |

### ContributionEvidenceTable (MVP: manual + link-only)

| Column                                 | Notes                                                      |
| -------------------------------------- | ---------------------------------------------------------- |
| organizationId, conversationId, userId | scope                                                      |
| kind                                   | `github_commit` \| `manual_link` \| `doc` \| `placeholder` |
| url, title?, occurredAt                | **no fabricated metrics** — store pointer + optional note  |
| normalizedScore?                       | Stretch: parser-fed                                        |

## Entity ↔ table map (PRD §21 quick reference)

| PRD entity                | ADK Table (MVP)                                                            |
| ------------------------- | -------------------------------------------------------------------------- |
| Organization              | `OrganizationsTable`                                                       |
| Project                   | _Stretch:_ `ProjectsTable`                                                 |
| User                      | `user.state` + Botpress user id                                            |
| GroupChat                 | `GroupChatsTable`                                                          |
| GroupChatMember           | `GroupChatMembersTable`                                                    |
| Role                      | `GroupChatMembersTable.workRole` + `user.state.role`                       |
| ChatSettings              | columns on `GroupChatsTable`                                               |
| ConsentRecord             | **`ConsentRecordsTable`**                                                  |
| Message                   | `MessagesTable`                                                            |
| Task                      | `TasksTable`                                                               |
| TaskEvidence              | `ContributionEvidenceTable`                                                |
| Review                    | `ReviewsTable`                                                             |
| PeerReview / LeaderReview | `ReviewsTable.reviewType`                                                  |
| TemperatureEvent          | `TemperatureEventsTable`                                                   |
| TemperatureSnapshot       | _Stretch:_ `TemperatureSnapshotsTable`                                     |
| ContributionMetric        | computed by `computeMetrics` (optional cache in `PerformanceReportsTable`) |
| IntegrationConnection     | `IntegrationConnectionsTable`                                              |
| PerformanceReport         | `PerformanceReportsTable`                                                  |
| AuditReport               | same row + Markdown blob / or separate `AuditReportsTable` Stretch         |
| JoinRequest               | `JoinRequestsTable`                                                        |
| AuditLog                  | `AuditLogsTable`                                                           |

## Repo layout

```
hackathon-bot/
├─ agent.config.ts          ← rename → 'peerTemp' (or `peertemp`); user/bot state; minimal configuration; webchat+chat+gsheets deps
├─ src/
│  ├─ schemas/              (optional) shared zod fragments imported by tables/actions — NOT auto-registered
│  ├─ lib/                  pure helpers: clampTemp, parseGithubRepo, redactPII
│  ├─ actions/
│  │  ├─ logActivity.ts            wraps actions.gsheets.appendValues
│  │  ├─ logTemperatureEvent.ts    central temp mutator — every Δ goes through this
│  │  ├─ logAudit.ts               every mutation appends here
│  │  ├─ fetchCommits.ts           public GitHub REST
│  │  ├─ scoreLanguage.ts          adk.zai.label → professional|neutral|informal|unprofessional|risky
│  │  ├─ extractTask.ts            adk.zai.extract message → {title, difficulty, hours, urgency, dueAt}
│  │  ├─ assignTask.ts             extractTask + persist + temp+                 (.asTool())
│  │  ├─ completeTask.ts           mark done, deadline economy, streak bonus     (.asTool())
│  │  ├─ submitPeerReview.ts       another member's °C rating + justification    (.asTool())
│  │  ├─ submitLeaderReview.ts     leader's °C rating, weighted higher            (.asTool(), leader-only)
│  │  ├─ adjustTemperature.ts      manual leader override w/ justification        (.asTool(), leader-only)
│  │  ├─ requestJoinGroupChat.ts   creates JoinRequest if below minTemp           (.asTool())
│  │  ├─ approveJoinRequest.ts     leader-only                                    (.asTool())
│  │  ├─ rejectJoinRequest.ts      leader-only                                    (.asTool())
│  │  ├─ checkRepo.ts              on-demand commit summary                       (.asTool())
│  │  ├─ configureGroupChat.ts     upsert GroupChatsTable settings                (.asTool(), leader-only)
│  │  ├─ configureOrganization.ts  upsert org scoring weights / role templates    (.asTool(), admin-only)
│  │  ├─ closeProject.ts           flips project status; triggers audit           (.asTool(), leader-only)
│  │  ├─ generatePerformanceReport.ts  per-user × per-period audit
│  │  ├─ generateRulesDocument.ts  Markdown charter for consent + Admin
│  │  ├─ getOrgDashboardBundle.ts  read-model JSON for org dashboard (optional)
│  │  ├─ getMemberProfile.ts       read-model for member profile (optional)
│  │  ├─ listLeaderboard.ts       ranked members for GC (optional)
│  │  ├─ ingestEvidence.ts        manual / link evidence row
│  │  └─ computeMetrics.ts         pure: derive normalized scores from events
│  ├─ workflows/
│  │  ├─ onboarding.ts             consent → role → org → GC → settings
│  │  ├─ decay.ts                  hourly: inactivity decay + overdue-task penalty
│  │  ├─ commitPoller.ts           5-min: per-GC public-repo commit ingestion
│  │  ├─ projectAudit.ts           kicked off by closeProject; fans out per member
│  │  └─ scheduledReview.ts        weekly/monthly/quarterly cron — auto-runs reviews per org schedule
│  ├─ conversations/
│  │  └─ router.ts                 main chat router; role-aware tool list
│  ├─ triggers/                    (delete placeholder if pollers run via workflow schedules)
│  └─ knowledge/                   (delete — RAG out of MVP)
└─ apps/web/                       (Vite + React; ADK-integrated per `adk-frontend` references)
   ├─ src/
   │  ├─ stores/clientsStore.ts          Zustand: getApiClient({ workspaceId, botId }), optional getZaiClient
   │  ├─ services/                       callAction + findTableRows wrappers (typed)
   │  ├─ routes/                         TanStack Router file routes
   │  ├─ components/                     GlassCard, TempBadge, charts, ChatPanel (webchat embed)
   │  └─ types/index.ts                  /// <reference …> to `../../../.adk/*.d.ts` (bot repo root)
   ├─ package.json
   └─ vite.config.ts
```

## Temperature mechanic

Baseline 36.5°C, clamped [35.0, 40.0]. **Every change goes through `logTemperatureEvent`** which writes a `TemperatureEventsTable` row — that's how the trend chart, "why did my temp change" tooltip, and audit log all stay honest.

| Event source                       | Default Δ                                                                                   | Notes                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------- |
| Task assigned to you               | +0.1                                                                                        | small bump for picking up work         |
| Task **completed before deadline** | `+0.5 × (urgency/5) × (difficulty/5)`                                                       | up to ~+0.5 per task                   |
| Task **completed late**            | +0.1                                                                                        | minimal credit                         |
| Task **overdue (per day)**         | −0.5                                                                                        | applied by `decay`, idempotent per day |
| GitHub commit attributed           | +0.2                                                                                        | from `commitPoller`                    |
| Peer °C review received            | `(peerRating − 36.5) × peerWeight`                                                          | default `peerWeight=0.05`              |
| Leader °C review received          | `(leaderRating − 36.5) × leaderWeight`                                                      | default `leaderWeight=0.10`            |
| Manual leader adjust               | explicit Δ from leader                                                                      | requires `justification` text          |
| Hourly inactivity                  | drift 0.1 toward `min(36.5, gc.minTemperatureToJoin)` when gate off, else toward gate floor | only if no activity in last hour       |
| 3 consecutive on-time tasks        | +0.3 streak bonus                                                                           | one-shot, resets on miss               |
| Professionalism: `risky`           | −0.4                                                                                        | per `scoreLanguage` flag               |
| Professionalism: `unprofessional`  | −0.2                                                                                        |                                        |
| Professionalism: `professional`    | +0.05 (capped daily)                                                                        | rewards good comms                     |

All numbers are **defaults**; org admins override via `OrganizationsTable.scoringWeights` (see Scoring engine).

## Scoring engine (per org configurable)

Each metric has `{ raw, normalized [0..1], weight, explanation }`. The current temperature is **not** a weighted sum — it's the running cumulative result of `TemperatureEventsTable`. The weights instead drive the **performance review** label and the displayed metric breakdown.

Default weights per the spec:

```ts
{
  responseTime:        0.20,
  participationVolume: 0.15,
  taskCompletion:      0.20,
  professionalism:     0.10,
  platformContribution:0.15,
  leaderEvaluation:    0.10,
  peerEvaluation:      0.10,
}
```

Stored on `OrganizationsTable.scoringWeights` (z.record). Admin tool `configureOrganization` can edit. The performance label thresholds (Outstanding ≥ 0.85, Strong ≥ 0.70, Stable ≥ 0.55, At Risk ≥ 0.40, else Critical) are also configurable.

## File-by-file spec

### 1. `agent.config.ts`

```ts
import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "peerTemp",
  description: "PeerTemp — temperature-ranked collaboration platform",

  defaultModels: {
    autonomous: "openai:gpt-4.1-mini-2025-04-14",
    zai: "openai:gpt-4.1-mini-2025-04-14",
  },

  bot: {
    state: z.object({
      lastCommitShaByGc: z.record(z.string()).default({}),
    }),
  },

  user: {
    state: z.object({
      temperature: z.number().default(36.5),
      hasConsented: z.boolean().default(false),
      role: z.enum(["admin", "leader", "member", "observer"]).default("member"), // platform role
      githubLogin: z.string().optional(),
      onTimeStreak: z.number().default(0),
      lastActivityAt: z.string().optional(),
      activeOrganizationId: z.string().optional(),
      activeConversationId: z.string().optional(),
      performanceLabel: z
        .enum(["outstanding", "strong", "stable", "at_risk", "critical"])
        .default("stable"),
    }),
  },

  configuration: {
    schema: z.object({
      defaultSheetId: z.string().optional(),
      defaultSheetRange: z.string().default("Activity!A:F"),
      pollerEnabled: z.boolean().default(true),
    }),
  },

  dependencies: {
    integrations: {
      // Pinned automatically by `adk add <name>`.
    },
  },
});
```

> Note: `user.state.role` is the **platform role** (admin/leader/member/observer). The richer **work role** per GC (Frontend, Backend, QA, …) lives in `GroupChatMembersTable.workRole` because one user can be Frontend in one GC and PM in another.

### 2. Tables

ADK rules: name ends in `Table`; never declare reserved `id / createdAt / updatedAt`; searchable strings use `{ searchable: true, schema: z.string() }`.

**`Organizations.ts`**

```ts
columns: {
  name:            { searchable: true, schema: z.string() },
  ownerUserId:     z.string(),
  scoringWeights:  z.record(z.number()).default({}),
  performanceThresholds: z.record(z.number()).default({}),
  reviewSchedule:  z.enum(['weekly','monthly','quarterly','semester','yearly','manual']).default('monthly'),
  reviewAnchorDate: z.string().optional(),                   // for cron alignment
  rules:           z.string().optional(),                    // free-form policy text
  rulesVersion:    z.string().default('1.0'),                 // bump → triggers consent renewal (Stretch workflow)
}
```

**`GroupChats.ts`**

```ts
columns: {
  conversationId:     z.string(),
  organizationId:     z.string(),
  title:              z.string(),
  description:        z.string().optional(),
  channel:            z.string(),
  leaderUserId:       z.string(),
  status:             z.enum(['active','archived','closed']).default('active'),
  // ── Aggregate metrics
  currentAvgTemperature: z.number().default(36.5),
  rating:                z.number().default(3),
  // ── Settings
  minTemperatureToJoin: z.number().default(0),               // 0 = open
  joinGateEnabled:      z.boolean().default(false),
  responseTimeSlaMin:   z.number().default(30),
  maxRepliesPerHour:    z.number().default(20),
  languageLevel:        z.enum(['formal','casual','informal']).default('formal'),
  audienceAgeBand:      z.enum(['kids','teen','adult','mixed']).default('adult'),
  links: z.object({
    github:      z.string().optional(),    // "owner/repo"
    googleDoc:   z.string().optional(),
    googleSheet: z.string().optional(),
    figma:       z.string().optional(),
    notion:      z.string().optional(),
    jira:        z.string().optional(),
    ppt:         z.string().optional(),
  }).default({}),
  reviewSchedule:       z.enum(['inherit','weekly','monthly','quarterly','semester','yearly','manual']).default('inherit'),
  startedAt:            z.string().optional(),
  closedAt:             z.string().optional(),
}
```

**`GroupChatMembers.ts`** — junction; one row per (user, GC)

```ts
columns: {
  conversationId: z.string(),
  userId:         z.string(),
  workRole:       z.enum([
    'project_manager','developer','frontend','backend','fullstack',
    'it_support','qa','designer','researcher','analyst','devops',
    'content_writer','presenter','other',
  ]).default('other'),
  joinedAt:       z.string(),
  status:         z.enum(['active','removed','left']).default('active'),
}
```

**`Tasks.ts`** — columns: `conversationId, organizationId, assigneeUserId?, assigneeInferred: z.boolean().default(false), title, description, confidence: z.number().optional(), difficulty (1-5), estimatedHours, urgency (1-5), dueAt, status, completedAt, completedOnTime, source, sourceMessageId, sourceCommitSha, sourceUrl`. **UI must distinguish inferred vs confirmed assignee.**

**`Messages.ts`** — minimal, MVP only stores timestamps + zai labels (full content lives in webchat history)

```ts
columns: {
  conversationId:  z.string(),
  senderUserId:    z.string(),
  postedAt:        z.string(),
  professionalism: z.enum(['professional','neutral','informal','unprofessional','risky']).optional(),
  meaningful:      z.boolean().optional(),  // zai-judged: substantive vs. ack/emoji
  responseToMs:    z.number().optional(),   // ms since previous message in chat
}
```

**`Reviews.ts`** — peer & leader °C ratings (NOT 1-5 stars)

```ts
columns: {
  conversationId:    z.string(),
  organizationId:    z.string(),
  reviewerUserId:    z.string(),
  revieweeUserId:    z.string(),
  reviewType:        z.enum(['peer','leader']).default('peer'),
  temperatureRating: z.number(),                              // e.g. 38.4
  justification:     { searchable: true, schema: z.string() },
  taskId:            z.string().optional(),
  periodStart:       z.string().optional(),
  periodEnd:         z.string().optional(),
}
```

**`TemperatureEvents.ts`** — the trend chart's source of truth

```ts
columns: {
  userId:          z.string(),
  conversationId:  z.string().optional(),
  organizationId:  z.string(),
  delta:           z.number(),
  beforeValue:     z.number(),
  afterValue:      z.number(),
  reason:          { searchable: true, schema: z.string() },  // "task completed on time: API integration"
  sourceType:      z.enum(['task','review','commit','manual','decay','language','streak']),
  sourceId:        z.string().optional(),
  metricWeight:    z.number().optional(),
  occurredAt:      z.string(),
}
```

**`JoinRequests.ts`** — `conversationId, userId, requesterTemperature, status (pending|approved|rejected), justification, decidedBy, decidedAt`.

**`AuditLogs.ts`** — `organizationId, actorUserId, action, target, payload (z.record(z.any())), at`.

**`IntegrationConnections.ts`** — `organizationId, kind (github|gdocs|gsheets|gslides|notion|figma|jira|trello), config (z.record(z.string())), enabled`. **MVP wires only `github` (public, no auth) and `gsheets`**; the others are inserted as `enabled=false` placeholders.

**`PerformanceReports.ts`** — see `generatePerformanceReport`.

**`ConsentRecords.ts`** — auditable consent; **append-only** in practice (no deletes in MVP).

```ts
columns: {
  organizationId:   z.string(),
  userId:           z.string(),
  conversationId:   z.string().optional(),
  acceptedAt:       z.string(),
  rulesVersion:     z.string().default('1.0'),
  rulesSnapshot:    z.string().describe('Markdown or canonical JSON of what user saw'),
  channel:          z.string().optional(),
}
```

**`ContributionEvidence.ts`** — link-level evidence only in MVP (see [ContributionEvidenceTable](#contributionevidencetable-mvp-manual--link-only)).

```ts
columns: {
  organizationId:  z.string(),
  conversationId:  z.string(),
  userId:           z.string(),
  kind:             z.enum(['github_commit','manual_link','doc','placeholder']),
  url:              z.string(),
  title:            z.string().optional(),
  occurredAt:       z.string(),
  notes:            z.string().optional(),
}
```

### 3. Actions

Handler signature is `async ({ input, client })` (per [src/actions/index.ts](src/actions/index.ts) placeholder).

**`logTemperatureEvent`** — the only place `user.state.temperature` is mutated. Computes new value, writes the event row, updates the user, returns the row. Every other action calls this instead of touching `user.state.temperature` directly. **This is the single most important invariant in the codebase.**

**`logAudit`** — appends to `AuditLogsTable`. Called from every leader/admin action.

**`logActivity`** — Sheet writer; sheetId per-call, falls back to `configuration.defaultSheetId`.

**`fetchCommits`** — public GitHub REST, `{ owner, repo, since? }` input.

**`scoreLanguage`** — `adk.zai.label(…)` + short safe explanation. **Only after** `user.state.hasConsented` **and** a row in `ConsentRecordsTable` for this org. Used by router on inbound messages and by `generatePerformanceReport`.

**`extractTask`** — `adk.zai.extract(rawMessage, schema)` returning structured task fields. Pulled out of `assignTask` so other entry points (e.g. webhook) can reuse.

**`assignTask`** — calls `extractTask`, inserts row, calls `logTemperatureEvent({ delta: +0.1, reason: 'task assigned' })`, calls `logActivity`.

**`completeTask`** — flips status to done, computes Δ from urgency × difficulty, applies streak bonus if applicable, calls `logTemperatureEvent`.

**`submitPeerReview`** / **`submitLeaderReview`** — write `ReviewsTable` row; call `logTemperatureEvent` on the reviewee using `(rating − 36.5) × weight` where `weight` reads from `org.scoringWeights.peerEvaluation` (or `leaderEvaluation`).

**`adjustTemperature`** — leader-only manual override. Required `justification`. Writes `TemperatureEventsTable` with `sourceType='manual'`. Also writes `AuditLogsTable`.

**`requestJoinGroupChat`** — checks user temp vs `gc.minTemperatureToJoin`. If pass, insert into `GroupChatMembersTable` directly. If fail, insert into `JoinRequestsTable` with status `pending` and notify the leader.

**`approveJoinRequest`** / **`rejectJoinRequest`** — leader-only; flips status, on approve inserts into `GroupChatMembersTable`. Writes audit.

**`checkRepo`** — reads `gc.links.github`, `fetchCommits`, summarizes via `adk.zai.summarize`.

**`configureGroupChat`** / **`configureOrganization`** — partial upserts over their respective tables; both write audit rows.

**`closeProject`** — flips `GroupChats.status='closed'` (or org-level project archival); fires `projectAudit` workflow; writes audit row.

**`computeMetrics`** — pure derivation: given `(userId, conversationId, periodStart, periodEnd)`, reads Messages/Tasks/Reviews/TemperatureEvents and returns the metric bundle:

```ts
{
  responseTime:        { raw: ms, normalized: 0..1, weight, explanation },
  participationVolume: { … },
  taskCompletion:      { … },
  deadlineAdherence:   { … },
  professionalism:     { … },
  platformContribution:{ … },   // commits + (stretch) gdocs/figma/etc
  leaderEvaluation:    { … },
  peerEvaluation:      { … },
  attendance:          { … },
}
```

**`generatePerformanceReport`** — for `(userId, organizationId, periodStart, periodEnd)`:

1. Pull all relevant rows.
2. Call `computeMetrics`.
3. Score = Σ `metric.normalized × metric.weight`.
4. Map score → label via `org.performanceThresholds`.
5. Run `adk.zai.summarize` with a **safety system instruction**: neutral, non-defamatory, evidence-cited; no insults or speculative character attacks.
6. Insert `PerformanceReportsTable` row + return Markdown.

**`generateRulesDocument`** — inputs `(organizationId, conversationId?)`; merges `OrganizationsTable` + `GroupChatsTable` settings into a **single Markdown** “accountability charter” (what is tracked, weights, cadence, visibility, join rules, language expectations). Used in onboarding + Admin preview.

**`getOrgDashboardBundle`** / **`getMemberProfile`** / **`listLeaderboard`** — read-model Actions returning JSON for `apps/web` (optional if you prefer many `findTableRows` calls; bundle reduces round-trips and keeps aggregation logic in one place).

**`ingestEvidence`** — validates URL, writes `ContributionEvidenceTable`; does **not** scrape arbitrary sites in MVP.

### 4. Workflows

**`onboarding`**

1. Greet + show short summary of tracking (**`generateRulesDocument`** output or template).
2. `step.request('consent')` — yes/no via `adk.zai.label`
3. If no → exit (no tracking, no `MessagesTable` metric rows).
4. If yes → insert **`ConsentRecordsTable`** row (`rulesSnapshot` = charter text, `rulesVersion` from org), then set `user.state.hasConsented = true`.
5. Ask platform role: admin / leader / member / observer
6. Branch:
   - **Admin**: ask org name → upsert `OrganizationsTable`, owner = self
   - **Leader**: pick org, then create or pick GC; if creating, ask for settings (min-temp gate, language level, repo link, role); set `leaderUserId = self`
   - **Member**: pick org → pick GC → if temp ≥ `minTemperatureToJoin` insert directly; else → `requestJoinGroupChat`
   - **Observer**: read-only join
7. Insert `GroupChatMembersTable` row with `workRole`

**`decay`** — hourly cron

- Iterate active GCs
- For each member: drift `temperature` 0.1 toward `gc.minTemperatureToJoin || 36.5` if `lastActivityAt > 1h ago` → `logTemperatureEvent({ sourceType: 'decay' })`
- Iterate `TasksTable` where `status != 'done'` AND `dueAt < now`: per overdue-day, −0.5 to assignee (idempotent — check `TemperatureEventsTable` for an existing decay event for that task on that day before applying)

**`commitPoller`** — 5-min cron

- Iterate GCs with `links.github` set and `status='active'`
- Parse "owner/repo", `fetchCommits({ owner, repo, since })`, dedupe vs `Tasks.sourceCommitSha`
- For each new commit: insert Task `(status='done', source='github')`, find the user via `user.state.githubLogin` map, `logTemperatureEvent({ delta: +0.2, sourceType: 'commit' })`, `logActivity`
- Persist newest SHA into `bot.state.lastCommitShaByGc[conversationId]`

**`projectAudit`** — kicked off by `closeProject`

- Input: `{ groupChatId | organizationId, periodStart?, periodEnd? }`
- For each member: `generatePerformanceReport`
- Bundle Markdown; post to leader's chat

**`scheduledReview`** — daily cron checks each org's `reviewSchedule`; if today is a review boundary, runs `generatePerformanceReport` for every active member and emails/posts results.

### 5. Central router — `src/conversations/router.ts`

```ts
const baseTools = [
  assignTask.asTool(),
  completeTask.asTool(),
  submitPeerReview.asTool(),
  checkRepo.asTool(),
  requestJoinGroupChat.asTool(),
];
const leaderTools = [
  ...baseTools,
  submitLeaderReview.asTool(),
  adjustTemperature.asTool(),
  approveJoinRequest.asTool(),
  rejectJoinRequest.asTool(),
  configureGroupChat.asTool(),
  closeProject.asTool(),
];
const adminTools = [...leaderTools, configureOrganization.asTool()];

const tools =
  user.state.role === "admin"
    ? adminTools
    : user.state.role === "leader"
      ? leaderTools
      : baseTools;

// Side effects on every inbound message:
const lang = await scoreLanguage({ input: { text: message.payload.text } });
await MessagesTable.createRows([
  {
    conversationId: conversation.id,
    senderUserId: user.id,
    postedAt: now,
    professionalism: lang.label,
    meaningful: lang.meaningful,
    responseToMs,
  },
]);
if (lang.label === "risky")
  await logTemperatureEvent({
    delta: -0.4,
    reason: "risky language",
    sourceType: "language",
  });
if (lang.label === "unprofessional")
  await logTemperatureEvent({
    delta: -0.2,
    reason: "unprofessional language",
    sourceType: "language",
  });
// (cap "professional" rewards once/day in handler)

await execute({
  instructions: [
    "You are PeerTemp, a measurable accountability assistant for a workplace group chat.",
    `Platform role: ${user.state.role}.  Org: ${gc?.organizationId}.  GC: ${conversation.id}.`,
    `Tone target: ${gc?.languageLevel}, audience: ${gc?.audienceAgeBand}.`,
    `Your temperature: ${user.state.temperature?.toFixed(1)}°C  (label: ${user.state.performanceLabel}).`,
    /* hint lines from adk.zai.extract over the message */
  ]
    .filter(Boolean)
    .join("\n"),
  tools,
});
```

### 6. PeerTemp frontend architecture (ADK-integrated)

This section is the **primary lever for hackathon "deep ADK" scoring**: the UI is not a separate REST backend — it is a **thin, type-safe shell** over the same ADK primitives (Actions + Tables + Zai) that power chat. Follow [`.claude/skills/adk-frontend/SKILL.md`](.claude/skills/adk-frontend/SKILL.md) and its `references/` (especially `overview.md`, `project-setup.md`, `type-generation.md`, `calling-actions.md`, `realtime-updates.md`).

#### 6.1 Architectural principle — actions as API, tables as database

Per `adk-frontend` `references/overview.md`:

- **Mutations** → `client.callAction({ type: '<actionName>', input })`. Every button in the SaaS UI (approve join, adjust temp, generate report, configure org) maps to a **named Action** in `src/actions/` so the same validation runs from **Conversation** and **browser**.
- **Reads** → `client.findTableRows({ table: '<TableName>', … })` for dashboards, leaderboards, timelines, and audit feeds — **no duplicated Postgres** for MVP. If a query is too heavy, add a **read-model Action** (`getOrgDashboardBundle`) that aggregates in the bot and returns one JSON blob (still ADK-first).

Prefer **server-adjacent** PAT usage: for local dev, a dev PAT in `apps/web/.env` is acceptable; for anything resembling production, use **cookie-stored PAT + OAuth cli-login** per `authentication.md` in the skill.

#### 6.2 Recommended stack (aligned with `adk-frontend` `project-setup.md`)

| Layer            | Choice                                 | Why                                                                                                         |
| ---------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Bundler          | **Vite** + React 19 + TypeScript       | Official `adk-frontend` scaffold path; fast HMR next to `adk dev`.                                          |
| Routing          | **TanStack Router**                    | Typed routes, layouts for org/gc shell.                                                                     |
| Server state     | **TanStack Query**                     | Cache + mutations + `invalidateQueries` after `callAction`; polling tiers for "near real-time" leaderboard. |
| Client singleton | **Zustand** `clientsStore`             | `getApiClient({ workspaceId, botId })` — never `new APIClient` per component (skill anti-pattern).          |
| Long AI calls    | **`getZaiClient()`** when needed       | Extended timeout for UI-triggered `generatePerformanceReport`-style actions (skill).                        |
| Styling          | **Tailwind** + **Liquid Glass** tokens | Premium SaaS look; data-first readability.                                                                  |

Optional: Radix primitives + `lucide-react` per skill UI section. Next.js is fine if the team prefers SSR for cookies — then replicate the same **service layer + triple-slash types** pattern; the **integration contract** (Actions + Tables) does not change.

#### 6.3 Monorepo layout — `apps/web` next to the bot

```
hackathon-bot/                    # ADK bot root (existing)
  agent.config.ts
  src/
  .adk/                           # generated by `adk dev` / `adk build` — SOURCE OF TRUTH for frontend types

apps/web/                         # NEW — PeerTemp shell
  src/
    stores/clientsStore.ts
    lib/env.ts                    # VITE_BOTPRESS_* (never commit PAT)
    types/index.ts                # triple-slash refs → ../../.adk/
    services/
      dashboard.ts                # findTableRows + callAction wrappers
      members.ts
      reviews.ts
      admin.ts
    routes/
      org/$orgId/index.tsx
      org/$orgId/gc/$gcId/index.tsx
      user/$userId/index.tsx
      org/$orgId/reviews/index.tsx
      org/$orgId/settings/index.tsx
    components/
      glass/GlassCard.tsx
      temp/TempBadge.tsx
      temp/TempTrendChart.tsx
      workspace/Leaderboard.tsx
      workspace/ChatPanel.tsx      # embeds Botpress webchat; passes conversationId if supported
```

**Root `package.json` (optional):** `concurrently "adk dev" "pnpm --filter web dev"` so one terminal runs bot + UI.

#### 6.4 Type generation — full stack type safety (non-negotiable for "deep ADK")

In `apps/web/src/types/index.ts`:

```typescript
/// <reference path="../../../.adk/action-types.d.ts" />
/// <reference path="../../../.adk/table-types.d.ts" />

import type { BotActionDefinitions } from "@botpress/runtime/_types/actions";
import type { TableDefinitions } from "@botpress/runtime/_types/tables";

export type GeneratePerformanceReportInput =
  BotActionDefinitions["generatePerformanceReport"]["input"];
export type TemperatureEventRow =
  TableDefinitions["TemperatureEventsTable"]["Output"];
// …aliases per table/action used by UI
```

**Workflow:** change bot schema → run `adk dev` → frontend picks up `.adk/*.d.ts` → TypeScript fails in UI if payload drifts. This is the main demo story for "ADK-native."

#### 6.5 Service layer — one function per product operation

Pattern from `calling-actions.md` / skill SKILL.md:

```typescript
// apps/web/src/services/members.ts
export async function fetchTemperatureSeries(
  userId: string,
  organizationId: string,
) {
  const client = getApiClient({ workspaceId, botId });
  const { rows } = await client.findTableRows({
    table: "TemperatureEventsTable",
    filter: { userId, organizationId },
    // …
  });
  return rows;
}

export async function triggerPerformanceReport(
  input: GeneratePerformanceReportInput,
) {
  const client =
    getZaiClient?.({ workspaceId, botId }) ??
    getApiClient({ workspaceId, botId });
  const result = await client.callAction({
    type: "generatePerformanceReport",
    input,
  });
  return result.output;
}
```

**Rule:** React components never call `client.callAction` inline — only `services/*` — so the same calls can be reused and tested.

#### 6.6 "Real-time" without a custom chat stack

- **Messaging** stays **webchat** (ADK integration) inside `ChatPanel.tsx`.
- **Dashboards** use TanStack Query **polling tiers** (from `realtime-updates.md`): e.g. leaderboard `refetchInterval: 10_000`, audit log `30_000`, org overview `60_000`. Document intervals in code comments.

#### 6.7 Screen map — routes × data sources × Actions

| Screen                    | Route                  | Reads (`findTableRows` / bundle filter)                                                        | Writes (`callAction`)                                                                                                                      |
| ------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Organization dashboard    | `/org/$orgId`          | `GroupChatsTable`, `AuditLogsTable`, aggregated temps via members or `PerformanceReportsTable` | `configureOrganization` (admin)                                                                                                            |
| Group chat workspace      | `/org/$orgId/gc/$gcId` | `GroupChatMembersTable`, `TasksTable`, `TemperatureEventsTable` (recent), `ReviewsTable`       | `approveJoinRequest`, `rejectJoinRequest`, `adjustTemperature`, `closeProject`, `configureGroupChat` (all gated by role in Action handler) |
| Member profile            | `/user/$userId`        | `TemperatureEventsTable`, `TasksTable`, `ReviewsTable`, `MessagesTable` (if exposed)           | optional `generatePerformanceReport` preview                                                                                               |
| Performance review center | `/org/$orgId/reviews`  | `PerformanceReportsTable`, compare via `computeMetrics` output                                 | `generatePerformanceReport`                                                                                                                |
| Admin settings            | `/org/$orgId/settings` | `OrganizationsTable`, `IntegrationConnectionsTable`                                            | `configureOrganization`, `configureGroupChat`                                                                                              |

**Glass / liquid CSS** (shared):

```css
.glass {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 15px;
}
```

**`TempBadge`:** map `performanceLabel` + numeric temp to color (cool → warm); never rely on color alone — pair with text label for a11y.

#### 6.8 Hackathon "deep ADK" checklist (surface-level = low score)

| Skill                                  | What to ship                                                                                                                                    | Evidence in repo                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **adk**                                | Tables, Workflows, Conversation router, **Zai** extract/label/summarize, tools via `Autonomous.Tool` / `Action.asTool()` per project convention | `src/tables`, `src/workflows`, `src/conversations`, `adk.zai` usage |
| **adk-integrations**                   | `webchat` + `gsheets` pinned via `adk add`, webchat theme/CSS, `adk info webchat` for field names                                               | `agent.config.ts`, integration blocks                               |
| **adk-frontend**                       | Vite app, Zustand client store, **triple-slash `.adk` types**, service-layer `callAction` + `findTableRows`                                     | `apps/web/src/services`, `types/index.ts`                           |
| **adk-evals**                          | Eval files for: consent onboarding, task extraction, peer °C review, join-gate                                                                  | `evals/*.eval.ts` or skill convention                               |
| **adk-debugger** / **adk-dev-console** | Trace-driven debugging doc in README: repro → `adk traces`, Dev Console steps                                                                   | [README.md](README.md) short section                                |
| **adk-docs**                           | One-page architecture + Action↔screen map (optional [`docs/PEERTEMP.md`](docs/PEERTEMP.md))                                                     | docs or README                                                      |

#### 6.9 Frontend UX, errors, and “production-minded MVP” polish

- **App shell:** left **nav rail** (org switcher → GC list → Review / Admin), main content, **right optional panel** for webchat on GC route only (Teams-like).
- **Loading:** TanStack Query `isPending` skeletons on **leaderboard + charts**; never block the whole shell on one `findTableRows`.
- **Errors:** map `callAction` failures to toast + **`AuditLogsTable` optional id** in message for leaders; 401 → redirect to auth / re-prompt PAT per skill.
- **Empty states:** first-time org (“Create your first group chat”), no tasks (“Paste a commitment in chat — PeerTemp will extract it”), no events (“Temperature history appears after your first scored action”).
- **Route context:** persist `activeOrganizationId` / `activeConversationId` in `user.state` **via** `configureOrganization` or lightweight `setActiveContext` Action so deep links (`/org/x/gc/y`) can restore chat/session where ADK allows.
- **Web embed:** `ChatPanel` documents **how** the webchat `clientId` / `botId` is passed (env vars); match the **same** `conversation.id` as GC `conversationId` where the integration supports it — if not, document the limitation for judges.

#### 6.10 `adk-docs` deliverable

- Short internal **`docs/PEERTEMP.md`** (or README section): bot overview diagram, **which Action to call for each screen**, and **eval** how-tos — kept in sync when Actions rename (optional file; only if you add docs).

#### 6.11 Observability checklist

| When                       | Tool                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Message didn’t score       | `adk traces`, Dev Console **Agent Steps** ([`adk-dev-console`](.claude/skills/adk-dev-console/SKILL.md))                           |
| Action type mismatch in UI | Regenerate `.adk`, restart TS server ([`adk-frontend` type-generation](.claude/skills/adk-frontend/references/type-generation.md)) |
| Flaky Zai                  | [`adk-debugger`](.claude/skills/adk-debugger/SKILL.md) + smaller prompts                                                           |
| Regression                 | [`adk-evals`](.claude/skills/adk-evals/SKILL.md) on onboarding + extraction + review                                               |

### 7. Webchat glassmorphism (in-bot)

Either Botpress Cloud **Webchat → Custom CSS**, or `dependencies.integrations.webchat.configuration` in `agent.config.ts` — **confirm field names with** `adk info webchat` (**adk-integrations**).

```css
.bpw-from-bot,
.bpw-from-user,
.bpw-composer,
.bpw-keyboard-quick_reply {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 15px;
}
.bpw-layout {
  background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%);
}
```

## Execution order

1. `cd /Users/aminebaha/hackathon-bot && npm install`
2. **Verify ADK APIs** (Pre-flight table) via `adk` skill.
3. Edit `agent.config.ts`.
4. `adk add chat && adk add webchat && adk add gsheets`.
5. **Tables** — Organizations, GroupChats, GroupChatMembers, Tasks, Messages, Reviews, TemperatureEvents, JoinRequests, **ConsentRecords**, **ContributionEvidence**, AuditLogs, IntegrationConnections, PerformanceReports; delete `src/tables/index.ts`.
6. **Helper actions first** — `logTemperatureEvent`, `logAudit`, `logActivity`, `scoreLanguage`, `extractTask`, `fetchCommits`, `computeMetrics`, **`generateRulesDocument`**. **Get `logTemperatureEvent` watertight before anything calls it.**
7. **Tool actions** — assignTask, completeTask, submitPeerReview, submitLeaderReview, adjustTemperature, requestJoinGroupChat, approveJoinRequest, rejectJoinRequest, checkRepo, configureGroupChat, configureOrganization, closeProject, generatePerformanceReport, **ingestEvidence**, **getOrgDashboardBundle / getMemberProfile / listLeaderboard** (as needed).
8. **Workflows** — onboarding, decay, commitPoller, projectAudit, scheduledReview.
9. **Conversation router** — `src/conversations/router.ts`.
10. Delete unused placeholder files.
11. **Webchat CSS**.
12. **`apps/web`** — scaffold with Vite + React per [`adk-frontend` `project-setup.md`](.claude/skills/adk-frontend/references/project-setup.md): `clientsStore`, `types/index.ts` triple-slash → `../../../.adk/` (paths relative to `apps/web/src/types`), service layer, TanStack Router + Query; implement all **five** screens in section **6.7**; optional root `concurrently` script to run beside `adk dev`.
13. **Verify** (next section).

## Verification

```bash
cd /Users/aminebaha/hackathon-bot
adk check --format json
adk dev --logs --no-open

# Org + leader + member onboarding (three separate conversations)
adk chat --conversation-id admin "I'm an admin, create org Acme"
adk chat --conversation-id lead  "I'm a leader, in Acme, create GC Project-X with min temp 36.5"
adk chat --conversation-id mem1  "join Acme Project-X as backend developer"

# Task lifecycle with extraction
adk chat --conversation-id mem1 "Sam, ship the auth endpoint by Friday — about 6h, hard, urgent"
adk chat --conversation-id sam  "I just finished the auth endpoint"

# Peer review (°C, not stars)
adk chat --conversation-id mem1 "Reviewing Sam: 38.4°C — solid, on time, clean PR"

# Leader override
adk chat --conversation-id lead "Adjust Sam +0.5 — went above scope to refactor middleware"

# Min-temp join gate
adk chat --conversation-id newbie "join Acme Project-X" # → JoinRequestsTable if below threshold

# Decay + audit
adk workflows run decay '{}'
adk chat --conversation-id lead "close Project-X"   # → projectAudit fires

# Inspect
adk traces --format json | head
# Open apps/web dev server (typically http://localhost:5173) while `adk dev` runs (often http://localhost:3001) — use Dev Console + traces to verify Action calls from the UI
```

## Demo script (90s)

1. Open frontend → Organization Dashboard. Acme org has 3 GCs; leaderboard shows current top performer at 38.7°C, one member flagged `at_risk` at 35.8°C.
2. Open Project-X GC Workspace — webchat embedded; member list with temp badges and roles.
3. In webchat: “Sam, ship the auth endpoint by Friday — about 6h, hard, urgent.” Bot extracts fields, creates task, Sheet logs it.
4. Sam: “done.” Bot runs `completeTask`; Sam’s badge ticks 36.7 → 37.2°C (TanStack Query refetch).
5. Open Sam’s profile — trend chart shows the spike; “Why?” lists the top `TemperatureEvents` rows.
6. Leader: “Reviewing Sam: 38.4°C — went above scope.” Temp ticks again; review row in history.
7. Stranger requests to join at 35.9°C; GC min temp 36.5°C → `JoinRequestsTable` pending; leader approves in UI → `approveJoinRequest`.
8. Leader closes Project-X → `projectAudit` / reports in chat and `PerformanceReportsTable` visible in Review Center.

## Safety, fairness, and ethics (MVP guardrails)

- **Consent-first:** no `MessagesTable` metric persistence and no **scoring** `scoreLanguage` until `ConsentRecordsTable` exists for that user–org (see §Consent-first onboarding).
- **Inference vs confirmation:** `TasksTable` includes `assigneeInferred: boolean` _(add to schema)_ and UI copy must not present inferred assignees as fact until confirmed in chat or via `completeTask` by assignee.
- **Bounded impact:** peer/leader review deltas use **weights** from org config; cap single-event Δ in `logTemperatureEvent` (e.g. max ±0.5 from one review) to prevent drama spikes.
- **Non-defamatory AI:** `generatePerformanceReport` and `scoreLanguage` use system prompts that forbid insults, stereotypes, and speculative moral judgment; cite **events** and **metrics** only.
- **Manual overrides:** `adjustTemperature` always requires `justification` + `AuditLogsTable` + `TemperatureEventsTable` with `sourceType='manual'`.
- **Visibility:** observers and students — mask peer **justification** text in UI if policy flag `auditVisibility` on GC says so _(Stretch: add column)_.

## Phased build roadmap (for Cursor)

| Phase | Goal                      | Deliverables                                                                                                              |
| ----- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **0** | Bot boots, types generate | `adk mcp:init --tool cursor` → [`.cursor/mcp.json`](.cursor/mcp.json); `agent.config.ts`, integrations, `adk check` clean |
| **1** | Data + invariant          | All **Tables** + **`logTemperatureEvent`** + **`logAudit`**                                                               |
| **2** | Chat MVP                  | Router, consent-gated scoring, assign/complete task, reviews, join gate                                                   |
| **3** | Automation                | `decay`, `commitPoller`, `scheduledReview`, Sheets log                                                                    |
| **4** | SaaS shell                | `apps/web` five screens + service layer + typed `callAction`                                                              |
| **5** | Polish + hackathon score  | `adk-evals`, README traces/Dev Console doc, glass webchat CSS                                                             |

## Out of scope / Stretch

- Real-time messaging in a custom (non-webchat) UI.
- Integrations beyond GitHub + Sheets — the table accepts them but only those two have wiring.
- Export to PDF/CSV.
- Cross-org leaderboards, search, federation.
- Automated emailing of reviews (in-chat post only for MVP).
- Mobile app.
- Deep RAG over project docs — `src/knowledge/` deleted.
- Compliance / SSO / audit-log immutability guarantees beyond the AuditLogs append-only convention.
