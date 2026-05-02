import { Workflow, actions, bot, z } from "@botpress/runtime";
import { GroupChatsTable } from "../tables/GroupChats";
import { GroupChatMembersTable } from "../tables/GroupChatMembers";
import { TasksTable } from "../tables/Tasks";
import { ContributionEvidenceTable } from "../tables/ContributionEvidence";
import { parseGithubRepo } from "../lib/temperature";

/**
 * Every 5 minutes: for each active GC with a github repo link, fetch new
 * commits, dedupe against bot.state.lastCommitShaByGc, and write a
 * Task(status=done, source=github) + ContributionEvidence row + +0.2 temp
 * event for the matching member (by user.state.githubLogin).
 */
export const commitPoller = new Workflow({
  name: "commitPoller",
  description: "Poll public GitHub repos linked to GCs for new commits.",
  schedule: "*/5 * * * *",
  input: z.object({}).default({}),
  output: z.object({ ingested: z.number() }),
  async handler() {
    let ingested = 0;
    const { rows: gcs } = await GroupChatsTable.findRows({
      filter: { status: "active" } as any,
      limit: 200,
    });

    for (const gc of gcs as any[]) {
      const repo = gc.links?.github;
      if (!repo) continue;
      const parsed = parseGithubRepo(repo);
      if (!parsed) continue;

      const lastSha = (bot.state as any).lastCommitShaByGc?.[gc.conversationId];

      let commits: any[] = [];
      try {
        const r = await (actions as any).fetchCommits({
          owner: parsed.owner,
          repo: parsed.repo,
          perPage: 20,
        });
        commits = r.commits as any[];
      } catch (err) {
        console.warn(`[commitPoller] ${parsed.owner}/${parsed.repo}:`, err);
        continue;
      }

      const newCommits: any[] = [];
      for (const c of commits) {
        if (c.sha === lastSha) break;
        newCommits.push(c);
      }
      if (!newCommits.length) continue;

      const { rows: members } = await GroupChatMembersTable.findRows({
        filter: { conversationId: gc.conversationId } as any,
        limit: 200,
      });

      for (const c of newCommits) {
        // Try to attribute to a member by github login (we store it on user.state
        // — but we don't have cheap reverse lookup here in MVP. So we record the
        // commit as evidence + a Task row, and leave fine-grained attribution
        // to the dashboard layer until a `usersByGithubLogin` index is added).
        await TasksTable.createRows({
          rows: [
            {
              organizationId: gc.organizationId,
              conversationId: gc.conversationId,
              title: c.message.split("\n")[0].slice(0, 200),
              description: c.message,
              status: "done",
              source: "github",
              sourceCommitSha: c.sha,
              sourceUrl: c.url,
              completedAt: c.date,
              completedOnTime: true,
            },
          ],
        });
        await ContributionEvidenceTable.createRows({
          rows: [
            {
              organizationId: gc.organizationId,
              conversationId: gc.conversationId,
              userId: c.author,
              kind: "github_commit",
              url: c.url,
              title: c.message.split("\n")[0].slice(0, 200),
              occurredAt: c.date,
              notes: `repo ${parsed.owner}/${parsed.repo}`,
            },
          ],
        });
        // Try direct attribution if any member's recorded githubLogin matches.
        const match = (members as any[]).find(
          (m) =>
            // We don't have githubLogin on the member row — best-effort by literal id match
            m.userId === c.author,
        );
        if (match) {
          await (actions as any).logTemperatureEvent({
            userId: match.userId,
            organizationId: gc.organizationId,
            conversationId: gc.conversationId,
            delta: 0.2,
            reason: `commit attributed: ${c.sha.slice(0, 7)}`,
            sourceType: "commit",
            sourceId: c.sha,
          });
        }
        ingested += 1;
      }

      (bot.state as any).lastCommitShaByGc = {
        ...((bot.state as any).lastCommitShaByGc ?? {}),
        [gc.conversationId]: newCommits[0].sha,
      };
    }
    return { ingested };
  },
});
