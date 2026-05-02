import { Action, z } from "@botpress/runtime";
import { OrganizationsTable } from "../tables/Organizations";
import { GroupChatsTable } from "../tables/GroupChats";
import { DEFAULT_WEIGHTS } from "../lib/temperature";

/**
 * Build a Markdown "accountability charter" merging org policy + GC settings.
 * Used by the onboarding workflow (consent gate) and the Admin/Review screens.
 */
export const generateRulesDocument = new Action({
  name: "generateRulesDocument",
  description: "Render a Markdown rules document for a given org / group chat.",
  input: z.object({
    organizationId: z.string(),
    conversationId: z.string().optional(),
  }),
  output: z.object({
    markdown: z.string(),
    rulesVersion: z.string(),
  }),
  async handler({ input }) {
    const { rows: orgs } = await OrganizationsTable.findRows({
      filter: { id: input.organizationId } as any,
      limit: 1,
    });
    const org = (orgs as any[])[0];

    let gc: any | undefined;
    if (input.conversationId) {
      const { rows } = await GroupChatsTable.findRows({
        filter: { conversationId: input.conversationId } as any,
        limit: 1,
      });
      gc = (rows as any[])[0];
    }

    const weights = { ...DEFAULT_WEIGHTS, ...(org?.scoringWeights ?? {}) };
    const orgName = org?.name ?? "this organization";
    const cadence =
      gc?.reviewSchedule && gc.reviewSchedule !== "inherit"
        ? gc.reviewSchedule
        : (org?.reviewSchedule ?? "monthly");

    const lines: string[] = [];
    lines.push(`# PeerTemp Accountability Charter — ${orgName}`);
    if (gc) lines.push(`### Group chat: ${gc.title}`);
    lines.push("");
    lines.push("## What is tracked");
    lines.push("- Response time to group messages");
    lines.push("- Participation volume (meaningful replies, not emoji acks)");
    lines.push("- Task assignment & on-time completion");
    lines.push(
      "- Communication tone (professional / neutral / informal / unprofessional / risky)",
    );
    lines.push(
      "- External contribution evidence (e.g. public GitHub commits) when linked",
    );
    lines.push("- Peer and leader **temperature** reviews");
    lines.push("");
    lines.push("## How temperature works");
    lines.push(
      "Every member starts at **36.5°C**. Healthy contribution warms you up; inactivity, missed deadlines, or unprofessional language cool you down. Range is **35.0–40.0°C**. Each change is logged with a reason.",
    );
    lines.push("");
    lines.push("## Scoring weights");
    for (const [k, v] of Object.entries(weights)) {
      lines.push(`- **${k}**: ${(Number(v) * 100).toFixed(0)}%`);
    }
    lines.push("");
    lines.push("## Group chat rules");
    if (gc) {
      lines.push(
        `- Expected response time: **${gc.responseTimeSlaMin ?? 30} min**`,
      );
      lines.push(`- Max replies/hour cap: **${gc.maxRepliesPerHour ?? 20}**`);
      lines.push(
        `- Language level: **${gc.languageLevel ?? "formal"}**, audience **${gc.audienceAgeBand ?? "adult"}**`,
      );
      lines.push(
        `- Min temperature to join: **${gc.joinGateEnabled ? gc.minTemperatureToJoin : "open"}**`,
      );
    } else {
      lines.push("- No group chat selected yet — defaults apply.");
    }
    lines.push("");
    lines.push("## Reviews");
    lines.push(`- Cadence: **${cadence}**`);
    lines.push(
      "- Leaders may submit **manual** temperature adjustments with a written justification (always logged).",
    );
    lines.push(
      "- Peer reviews use a **°C rating** with required justification.",
    );
    lines.push("");
    lines.push("## Your rights");
    lines.push(
      "- You can withdraw consent at any time — this stops content scoring; existing audit rows are not deleted.",
    );
    lines.push(
      "- Every temperature change is explainable: see *Why?* in your member profile.",
    );
    if (org?.rules) {
      lines.push("");
      lines.push("## Additional org policy");
      lines.push(org.rules);
    }

    return {
      markdown: lines.join("\n"),
      rulesVersion: org?.rulesVersion ?? "1.0",
    };
  },
});
