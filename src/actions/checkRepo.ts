import { Action, actions, adk, z } from "@botpress/runtime";
import { GroupChatsTable } from "../tables/GroupChats";
import { parseGithubRepo } from "../lib/temperature";

export const checkRepo = new Action({
  name: "checkRepo",
  description:
    "Pull recent commits from this group chat's linked GitHub repo and summarize them.",
  input: z.object({
    conversationId: z.string(),
    limit: z.number().min(1).max(20).default(10),
  }),
  output: z.object({
    summary: z.string(),
    commits: z.array(
      z.object({
        sha: z.string(),
        message: z.string(),
        author: z.string(),
        url: z.string(),
      }),
    ),
  }),
  async handler({ input }) {
    const { rows } = await GroupChatsTable.findRows({
      filter: { conversationId: input.conversationId } as any,
      limit: 1,
    });
    const gc = (rows as any[])[0];
    const repo = gc?.links?.github;
    if (!repo) {
      return {
        summary:
          "No GitHub repository is linked to this group chat. Ask a leader to run `configureGroupChat` with a github link.",
        commits: [],
      };
    }
    const parsed = parseGithubRepo(repo);
    if (!parsed) {
      return {
        summary: `Couldn\u2019t parse "${repo}" as owner/repo.`,
        commits: [],
      };
    }

    const { commits } = await (actions as any).fetchCommits({
      owner: parsed.owner,
      repo: parsed.repo,
      perPage: input.limit,
    });
    if (!commits.length) {
      return { summary: "No recent commits found.", commits: [] };
    }

    const bullet = commits
      .slice(0, input.limit)
      .map(
        (c: any) =>
          `- ${c.author}: ${c.message.split("\n")[0]} (${c.sha.slice(0, 7)})`,
      )
      .join("\n");

    let summary = bullet;
    try {
      summary = await (adk as any).zai.summarize(bullet, {
        prompt:
          "Summarize what shipped in 2-3 short sentences for a project manager. Cite authors. No speculation.",
        length: 200,
      });
    } catch {
      // fall back to bulleted list
    }
    return { summary, commits };
  },
});
