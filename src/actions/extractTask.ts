import { Action, adk, z } from "@botpress/runtime";

/**
 * Use Zai to extract a structured task from a free-form message.
 * Pulled out of `assignTask` so other entry points (webhook, commit poller)
 * can reuse the same extraction with full type safety.
 */
export const extractTask = new Action({
  name: "extractTask",
  description: "Extract a structured task from a chat message via Zai.",
  input: z.object({
    text: z.string(),
    /** Free-form list of known member display names — helps the model resolve assignee. */
    knownMembers: z.array(z.string()).optional(),
  }),
  output: z.object({
    isTask: z.boolean(),
    title: z.string().optional(),
    description: z.string().optional(),
    assigneeHint: z.string().optional(),
    difficulty: z.number().optional(),
    estimatedHours: z.number().optional(),
    urgency: z.number().optional(),
    dueAt: z.string().optional(),
    confidence: z.number().optional(),
  }),
  async handler({ input }) {
    const schema = z.object({
      isTask: z
        .boolean()
        .describe(
          "True if the message contains a clear commitment or task request",
        ),
      title: z
        .string()
        .optional()
        .describe("Short imperative title — verb first"),
      description: z.string().optional(),
      assigneeHint: z
        .string()
        .optional()
        .describe("Name of the person being asked, if any"),
      difficulty: z.number().min(1).max(5).optional(),
      estimatedHours: z.number().optional(),
      urgency: z.number().min(1).max(5).optional(),
      dueAt: z.string().optional().describe("ISO 8601 if a date was mentioned"),
      confidence: z.number().min(0).max(1).optional(),
    });

    const knownMembers = input.knownMembers?.length
      ? `Known members: ${input.knownMembers.join(", ")}.\n`
      : "";

    try {
      const result = await (adk as any).zai.extract(
        `${knownMembers}Message: "${input.text}"`,
        schema,
      );
      return result as z.infer<typeof schema>;
    } catch (err) {
      console.warn("[extractTask] zai.extract failed:", err);
      return { isTask: false };
    }
  },
});
