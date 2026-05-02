import { Table, z } from "@botpress/runtime";

export const IntegrationConnectionsTable = new Table({
  name: "IntegrationConnectionsTable",
  description:
    "Per-org connections to external evidence sources (GitHub, Google, etc.).",
  columns: {
    organizationId: z.string(),
    kind: z.enum([
      "github",
      "gdocs",
      "gsheets",
      "gslides",
      "notion",
      "figma",
      "jira",
      "trello",
    ]),
    config: z.record(z.string()).default({}),
    enabled: z.boolean().default(false),
    addedAt: z.string(),
  },
});
