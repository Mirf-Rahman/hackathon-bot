import { Action, z } from "@botpress/runtime";

/**
 * Public GitHub REST — no auth, 60 req/h limit. Used by checkRepo and
 * commitPoller. We deliberately avoid the github integration so private
 * repos / PR triggers stay out of MVP scope.
 */
export const fetchCommits = new Action({
  name: "fetchCommits",
  description: "Fetch recent commits from a public GitHub repository.",
  input: z.object({
    owner: z.string(),
    repo: z.string(),
    since: z.string().optional().describe("ISO 8601 — only commits after this"),
    perPage: z.number().min(1).max(100).default(20),
  }),
  output: z.object({
    commits: z.array(
      z.object({
        sha: z.string(),
        message: z.string(),
        author: z.string(),
        url: z.string(),
        date: z.string(),
      }),
    ),
  }),
  async handler({ input }) {
    const url = new URL(
      `https://api.github.com/repos/${input.owner}/${input.repo}/commits`,
    );
    url.searchParams.set("per_page", String(input.perPage));
    if (input.since) url.searchParams.set("since", input.since);

    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "peertemp-bot",
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status} ${res.statusText}`);
    }
    const raw = (await res.json()) as any[];

    return {
      commits: raw.map((c) => ({
        sha: c.sha,
        message: String(c.commit?.message ?? "").slice(0, 500),
        author: c.author?.login ?? c.commit?.author?.name ?? "unknown",
        url: c.html_url,
        date: c.commit?.author?.date ?? new Date().toISOString(),
      })),
    };
  },
});
