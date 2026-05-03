import { Conversation, actions, user } from "@botpress/runtime";
import { ConsentRecordsTable } from "../tables/ConsentRecords";
import { GroupChatsTable } from "../tables/GroupChats";
import { MessagesTable } from "../tables/Messages";

import { assignTask } from "../actions/assignTask";
import { completeTask } from "../actions/completeTask";
import { submitPeerReview } from "../actions/submitPeerReview";
import { submitLeaderReview } from "../actions/submitLeaderReview";
import { adjustTemperature } from "../actions/adjustTemperature";
import { requestJoinGroupChat } from "../actions/requestJoinGroupChat";
import { approveJoinRequest } from "../actions/approveJoinRequest";
import { rejectJoinRequest } from "../actions/rejectJoinRequest";
import { checkRepo } from "../actions/checkRepo";
import { configureGroupChat } from "../actions/configureGroupChat";
import { configureOrganization } from "../actions/configureOrganization";
import { closeProject } from "../actions/closeProject";
import { ingestEvidence } from "../actions/ingestEvidence";

const baseTools = () => [
  assignTask.asTool(),
  completeTask.asTool(),
  submitPeerReview.asTool(),
  checkRepo.asTool(),
  requestJoinGroupChat.asTool(),
  ingestEvidence.asTool(),
];

const leaderTools = () => [
  ...baseTools(),
  submitLeaderReview.asTool(),
  adjustTemperature.asTool(),
  approveJoinRequest.asTool(),
  rejectJoinRequest.asTool(),
  configureGroupChat.asTool(),
  closeProject.asTool(),
];

const adminTools = () => [...leaderTools(), configureOrganization.asTool()];

/**
 * Single PeerTemp router for all chat channels. Webchat lives in `apps/web`,
 * other channels (chat, etc.) work too because we use channel '*'.
 */
export default new Conversation({
  channel: ["webchat.channel", "chat.channel"],
  async handler({ message, conversation, execute }) {
    const userId = (user as any).id ?? "unknown";
    const conversationId = (conversation as any).id ?? "unknown";
    const role = (user.state.role ?? "member") as
      | "admin"
      | "leader"
      | "member"
      | "observer";

    // Resolve active GC + org context
    const { rows: gcs } = await GroupChatsTable.findRows({
      filter: { conversationId } as any,
      limit: 1,
    });
    const gc = (gcs as any[])[0];
    const organizationId =
      gc?.organizationId ?? user.state.activeOrganizationId;

    // Consent gate — until an auditable consent row exists, no scoring + no Messages writes.
    // Always re-check the table because per-process user.state may be cold for a new
    // dev-server invocation; organizationId can be 'default' for fresh conversations.
    const consentOrgId = organizationId ?? "default";
    let hasConsent = Boolean(user.state.hasConsented);
    if (!hasConsent) {
      const { rows: consents } = await ConsentRecordsTable.findRows({
        filter: { userId, organizationId: consentOrgId } as any,
        limit: 1,
      });
      hasConsent = (consents as any[]).length > 0;
      if (hasConsent) user.state.hasConsented = true;
    }

    if (!hasConsent) {
      const replyText =
        message?.type === "text" ? ((message as any).payload?.text ?? "") : "";

      // Accept inline if the user agrees in this turn.
      const looksLikeAgreement =
        /\b(i\s*agree|agree|yes|consent|ok(ay)?)\b/i.test(replyText);
      let charterMd =
        "PeerTemp tracks responsiveness, task completion, language tone, and peer/leader reviews to compute a temperature score (°C).";
      let rulesVersion = "1.0";
      try {
        const r = (await (actions as any).generateRulesDocument({
          organizationId: organizationId ?? "default",
          conversationId,
        })) as { markdown: string; rulesVersion: string };
        charterMd = r.markdown;
        rulesVersion = r.rulesVersion;
      } catch {
        // fall back to defaults
      }

      const send = (text: string) =>
        (conversation.send as any)({
          type: "text",
          payload: { text },
        });

      if (looksLikeAgreement) {
        await ConsentRecordsTable.createRows({
          rows: [
            {
              organizationId: organizationId ?? "default",
              userId,
              conversationId,
              acceptedAt: new Date().toISOString(),
              rulesVersion,
              rulesSnapshot: charterMd,
              channel: undefined,
            },
          ],
        });
        user.state.hasConsented = true;
        if (organizationId) user.state.activeOrganizationId = organizationId;
        user.state.activeConversationId = conversationId;
        await send(
          "Consent recorded. You're starting at **36.5°C**. Tell me about a task, ask to join a group chat, or report what you finished — I'll handle the bookkeeping.",
        );
        return;
      }

      await send(
        "Welcome to PeerTemp. Before I start tracking anything, please review:\n\n" +
          charterMd +
          '\n\nReply **"I agree"** to consent and start, or anything else to keep this read-only.',
      );
      return;
    }

    if (message?.type !== "text") return;
    const text = (message as any).payload?.text ?? "";

    // Side effects (consent-gated above):
    let label: string = "neutral";
    let meaningful = false;
    try {
      const lang = (await (actions as any).scoreLanguage({ text })) as {
        label: string;
        meaningful: boolean;
      };
      label = lang.label;
      meaningful = lang.meaningful;
    } catch {
      // ignore — fall through with defaults
    }

    await MessagesTable.createRows({
      rows: [
        {
          conversationId,
          organizationId,
          senderUserId: userId,
          senderDisplayName:
            (user.state as any).displayName ?? undefined,
          text,
          postedAt: new Date().toISOString(),
          professionalism: label as any,
          meaningful,
          responseToMs: undefined,
        },
      ],
    });

    if (organizationId && label === "risky") {
      await (actions as any).logTemperatureEvent({
        userId,
        organizationId,
        conversationId,
        delta: -0.4,
        reason: "risky language",
        sourceType: "language",
      });
    } else if (organizationId && label === "unprofessional") {
      await (actions as any).logTemperatureEvent({
        userId,
        organizationId,
        conversationId,
        delta: -0.2,
        reason: "unprofessional language",
        sourceType: "language",
      });
    }

    const tools =
      role === "admin"
        ? adminTools()
        : role === "leader"
          ? leaderTools()
          : baseTools();

    await execute({
      instructions: [
        "You are PeerTemp, a measurable accountability assistant for a workplace group chat.",
        `Platform role: ${role}. Org: ${organizationId ?? "unknown"}. GC: ${conversationId}.`,
        gc
          ? `Tone target: ${gc.languageLevel}, audience: ${gc.audienceAgeBand}.`
          : null,
        `User temperature: ${(user.state.temperature ?? 36.5).toFixed(1)}°C (label: ${user.state.performanceLabel ?? "stable"}).`,
        "When the user describes a commitment or asks someone to do work, call assignTask with structured fields.",
        "When the user reports completing work, call completeTask with the relevant taskId.",
        "When the user gives a colleague a temperature rating in °C, call submitPeerReview (or submitLeaderReview if you are a leader).",
        "Manual temperature adjustments by leaders MUST include a justification.",
        "Be concise and cite the temperature mechanic when explaining why something changed.",
      ]
        .filter(Boolean)
        .join("\n"),
      tools,
    });
  },
});
