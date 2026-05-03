import { Workflow, actions, adk, user, z } from "@botpress/runtime";
import { ConsentRecordsTable } from "../tables/ConsentRecords";
import { OrganizationsTable } from "../tables/Organizations";
import { GroupChatsTable } from "../tables/GroupChats";
import { GroupChatMembersTable } from "../tables/GroupChatMembers";

/**
 * Onboarding flow:
 *   1. Show the rules document.
 *   2. Ask for consent. If declined → exit (no tracking persisted).
 *   3. Pick role (admin / leader / member / observer).
 *   4. Branch:
 *        admin   → create / pick organization (becomes ownerUserId)
 *        leader  → pick org, create / pick GC, become leaderUserId
 *        member  → pick org, pick GC, gate-check or join request
 *        observer→ pick org, pick GC, read-only join
 */
export const onboarding = new Workflow({
  name: "onboarding",
  description: "PeerTemp consent + role + org + GC selection workflow.",
  input: z.object({
    conversationId: z.string(),
    organizationId: z.string().optional(),
    role: z.enum(["admin", "leader", "member", "observer"]).optional(),
  }),
  output: z.object({
    consented: z.boolean(),
    organizationId: z.string().optional(),
    conversationId: z.string().optional(),
  }),
  async handler(props) {
    const { input, step } = props;
    const request = (props as any).request;
    const userId = (user as any).id ?? "unknown";

    // Step 1 — show charter
    const { markdown, rulesVersion } = await step("rules", async () => {
      return (await (actions as any).generateRulesDocument({
        organizationId: input.organizationId ?? "default",
        conversationId: input.conversationId,
      })) as { markdown: string; rulesVersion: string };
    });

    // Step 2 — ask for consent
    const consent = await step("consent", async () => {
      const answer = await request?.workflow?.provide?.("consent_answer", {
        prompt:
          "Before PeerTemp tracks anything, please review the accountability charter and confirm.\n\n" +
          markdown +
          '\n\nReply "I agree" to consent, or anything else to decline.',
      });
      const accepted = await (adk as any).zai.check(
        String((answer as any)?.text ?? answer ?? ""),
        "expresses agreement / consent / acceptance",
      );
      return Boolean(accepted);
    });

    if (!consent) {
      return { consented: false };
    }

    // Step 3 — persist consent
    await step("record_consent", async () => {
      await ConsentRecordsTable.createRows({
        rows: [
          {
            organizationId: input.organizationId ?? "default",
            userId,
            conversationId: input.conversationId,
            acceptedAt: new Date().toISOString(),
            rulesVersion,
            rulesSnapshot: markdown,
            channel: undefined,
          },
        ],
      });
      user.state.hasConsented = true;
    });

    // Step 4 — bind active context
    await step("bind_context", async () => {
      if (input.organizationId)
        user.state.activeOrganizationId = input.organizationId;
      user.state.activeConversationId = input.conversationId;
      if (input.role) user.state.role = input.role;
    });

    return {
      consented: true,
      organizationId: input.organizationId,
      conversationId: input.conversationId,
    };
  },
});

// Keep imports from being elided by tree-shakers — these tables are used
// implicitly by other workflows that share this module.
void OrganizationsTable;
void GroupChatsTable;
void GroupChatMembersTable;
