import { Action, adk, z } from "@botpress/runtime";

const LABELS = [
  "professional",
  "neutral",
  "informal",
  "unprofessional",
  "risky",
] as const;
type Label = (typeof LABELS)[number];

/**
 * Classify a chat message's communication style. Caller is responsible for
 * ensuring consent has been granted (see ConsentRecordsTable) before persisting
 * scores or applying temperature deltas.
 */
export const scoreLanguage = new Action({
  name: "scoreLanguage",
  description:
    "Classify communication style of a chat message: professional|neutral|informal|unprofessional|risky.",
  input: z.object({
    text: z.string(),
  }),
  output: z.object({
    label: z.enum(LABELS),
    meaningful: z.boolean(),
    explanation: z.string(),
  }),
  async handler({ input }) {
    const text = input.text.trim();
    if (!text) {
      return {
        label: "neutral" as Label,
        meaningful: false,
        explanation: "empty message",
      };
    }

    try {
      const labels = await (adk as any).zai.label(text, {
        professional:
          "reads as polite, professional workplace communication with clear ownership",
        neutral: "plain neutral phrasing, neither formal nor unprofessional",
        informal: "casual or slang phrasing typical of friend chat",
        unprofessional:
          "rude, sloppy, or low-effort phrasing inappropriate for a workplace",
        risky:
          "contains slurs, harassment, threats, or discriminatory language",
        meaningful: "substantive content, not a one-word ack or pure emoji",
      });

      const labelOrder: Label[] = [
        "risky",
        "unprofessional",
        "informal",
        "neutral",
        "professional",
      ];
      const winner = labelOrder.find((l) => (labels as any)[l]) ?? "neutral";
      const meaningful = Boolean((labels as any).meaningful);

      const explanation =
        winner === "risky"
          ? "Risky language detected — please rephrase respectfully."
          : winner === "unprofessional"
            ? "Unprofessional phrasing for this group."
            : winner === "informal"
              ? "Informal tone — fine for casual chats."
              : winner === "professional"
                ? "Professional, accountable tone."
                : "Neutral communication.";

      return { label: winner, meaningful, explanation };
    } catch (err) {
      console.warn(
        "[scoreLanguage] zai.label failed, falling back to neutral:",
        err,
      );
      return {
        label: "neutral" as Label,
        meaningful: text.length > 12,
        explanation: "fallback (zai unavailable)",
      };
    }
  },
});
