/**
 * Context-aware temperature scorer. Replaces the old keyword-only heuristic
 * with multi-signal intent detection so the SPA can preview an accurate °C
 * delta the moment a user starts typing.
 *
 * The score is the sum of several detected signals (capped to ±0.45). Each
 * signal explains itself, so the preview chip can show WHY the temperature
 * is moving instead of an opaque number.
 *
 * The bot's server-side `scoreLanguage` LLM still runs in parallel via the
 * chat-integration fan-out and can append more nuanced telemetry events.
 */

export type Tone =
  | "risky"
  | "unprofessional"
  | "lazy"
  | "neutral"
  | "engaged"
  | "substantive";

export type Intent =
  | "completion" // shipped / merged / fixed / done
  | "commitment" // I'll do X / on it / picking up
  | "blocker" // stuck on / blocked / can't / waiting on
  | "question" // can you / could you / what's / where is
  | "help_offer" // I can / let me / happy to / I'll grab
  | "praise" // great work / nice / thanks for X
  | "complaint" // ugh / annoying / again / stupid
  | "social" // lunch / weekend / weather small talk
  | "lazy_ack" // k / kk / lol / idk
  | "rude" // unprofessional / risky
  | "shouting"
  | "report"; // status update / progress / review

export type Signal = {
  intent: Intent;
  delta: number;
  reason: string;
  /** Source pattern that triggered this signal — used for tooltips. */
  match?: string;
};

export type ToneResult = {
  tone: Tone;
  professionalism:
    | "professional"
    | "neutral"
    | "informal"
    | "unprofessional"
    | "risky";
  meaningful: boolean;
  delta: number;
  /** Aggregate one-line reason for the toast / event log. */
  reason: string;
  /** Per-signal breakdown for the live preview chip tooltip. */
  signals: Signal[];
};

// ── Vocabulary ─────────────────────────────────────────────────────

const RISKY = [
  "kill yourself",
  "kys",
  "n-word",
  "retard",
  "retarded",
  "rape",
  "rapist",
  "go die",
];

const UNPROFESSIONAL = [
  "idiot",
  "moron",
  "stupid",
  "dumb",
  "wtf",
  "fuck",
  "fck",
  "shit",
  "crap",
  "bullshit",
  "bs",
  "asshole",
  "jerk",
  "loser",
  "garbage",
  "trash",
  "useless",
  "incompetent",
  "screw you",
  "shut up",
  "stfu",
  "gtfo",
];

const LAZY_TOKENS = new Set([
  "k",
  "kk",
  "kkk",
  "ok",
  "okay",
  "yep",
  "yup",
  "yea",
  "yeah",
  "nope",
  "nah",
  "lol",
  "lmao",
  "rofl",
  "idk",
  "idc",
  "tbh",
  "imo",
  "sure",
  "fine",
  "whatever",
  "meh",
  "mhm",
  "hmm",
  "huh",
  "thx",
  "ty",
  "np",
  "ig",
  "smh",
  "fr",
  "bet",
  "bruh",
  "bro",
  "dude",
]);

// ── Intent patterns ────────────────────────────────────────────────
//
// Each pattern is paired with a delta + label. Multiple patterns can match
// a single message (e.g. completion + substantive length). We dedupe by
// intent so we don't reward "shipped...shipped" twice.

type Pattern = {
  intent: Intent;
  re: RegExp;
  delta: number;
  reason: string;
};

const PATTERNS: Pattern[] = [
  // Completion / delivery signals
  {
    intent: "completion",
    re: /\b(shipped|merged|deployed|released|landed|pushed (the|a) (pr|fix|patch)|just shipped|just merged|just deployed)\b/i,
    delta: 0.3,
    reason: "shipped / merged work",
  },
  {
    intent: "completion",
    re: /\b(done|finished|completed|wrapped (it )?up|knocked (it|that) out|all set on)\b/i,
    delta: 0.2,
    reason: "task completed",
  },
  {
    intent: "completion",
    re: /\b(fixed|patched|resolved|closed (the )?(bug|ticket|issue))\b/i,
    delta: 0.22,
    reason: "fixed an issue",
  },
  {
    intent: "completion",
    re: /\b(pr (open|up|ready)|draft pr|opened (a )?pr)\b/i,
    delta: 0.18,
    reason: "PR opened",
  },

  // Commitment signals
  {
    intent: "commitment",
    re: /\b(i'?ll (take|grab|pick (this|that|it) up|handle|own)|on it|i'?m on (it|this)|got it|i can take|let me take|i'?ll have|by (eod|tomorrow|monday|tuesday|wednesday|thursday|friday|end of week|end of day))\b/i,
    delta: 0.18,
    reason: "committed to work",
  },
  {
    intent: "commitment",
    re: /\b(i'?ll get (this|that|it) done|i'?ll ship|i'?ll write|i'?ll wire|i'?ll implement|i'?ll review|i'?ll test)\b/i,
    delta: 0.15,
    reason: "committed to follow-up",
  },

  // Help offers
  {
    intent: "help_offer",
    re: /\b(happy to (help|pair|jump in|review)|i can pair|let me know if|holler if|ping me if|i'?ll review|i can review)\b/i,
    delta: 0.12,
    reason: "offered help",
  },

  // Status reports / progress updates
  {
    intent: "report",
    re: /\b(eta|update|progress|currently|working on|in progress|wip|investigating|looking into|debugging|drafting|writing|implementing|wiring|spec(c?ing| ?out)|reviewing)\b/i,
    delta: 0.1,
    reason: "status update",
  },

  // Constructive questions / collaboration
  {
    intent: "question",
    re: /\b(could you|can you|would you|anyone know|anyone got|where (is|are)|how (do|should|can)|what'?s the|is there a|do we have)\b/i,
    delta: 0.06,
    reason: "asked for input",
  },

  // Praise / recognition
  {
    intent: "praise",
    re: /\b(great (work|job|stuff)|nice (work|job|catch)|well done|huge thanks|appreciate (it|you)|kudos|love this|thanks for (the|that))\b/i,
    delta: 0.08,
    reason: "recognized a teammate",
  },

  // Blockers — neutral signal (small + because flagging early matters), but
  // pure complaining without a block lands as a complaint instead.
  {
    intent: "blocker",
    re: /\b(blocked on|stuck on|waiting on|need help with|can'?t (proceed|continue)|blocker)\b/i,
    delta: 0.05,
    reason: "flagged a blocker",
  },

  // Complaints / dismissive
  {
    intent: "complaint",
    re: /\b(this is (annoying|broken|stupid|dumb)|why (does|do|is|are) (this|that|it|we) (always|still|keeps?)|so annoying|ugh|seriously\?|sigh|smh)\b/i,
    delta: -0.12,
    reason: "complaint without action",
  },
  {
    intent: "complaint",
    re: /\b(again\?\.?$|not again|nobody (cares|reads|listens)|who (cares|reads)|this sucks|that sucks)\b/i,
    delta: -0.15,
    reason: "dismissive complaint",
  },

  // Social / off-topic
  {
    intent: "social",
    re: /\b(lunch|coffee|weekend|weather|holiday|vacation|netflix|game last night|sportsball)\b/i,
    delta: 0,
    reason: "social chat",
  },
];

// ── Helpers ────────────────────────────────────────────────────────

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/(.)\1{2,}/g, "$1$1")); // looool → lool
}

function isOnlyEmoji(s: string): boolean {
  // eslint-disable-next-line no-misleading-character-class
  return (
    /^[\p{Emoji}\p{Emoji_Presentation}\p{Extended_Pictographic}\s\p{P}]+$/u.test(s) &&
    /\p{Extended_Pictographic}/u.test(s)
  );
}

function containsAny(haystack: string, needles: string[]): string | null {
  for (const n of needles) {
    if (n.includes(" ")
      ? haystack.includes(n)
      : new RegExp(`\\b${n}\\b`).test(haystack)) {
      return n;
    }
  }
  return null;
}

function pickHighestPerIntent(signals: Signal[]): Signal[] {
  const best = new Map<Intent, Signal>();
  for (const s of signals) {
    const cur = best.get(s.intent);
    if (!cur || Math.abs(s.delta) > Math.abs(cur.delta)) best.set(s.intent, s);
  }
  return Array.from(best.values());
}

// ── Main scorer ────────────────────────────────────────────────────

export function scoreText(rawText: string): ToneResult {
  const text = rawText.trim();
  if (!text) {
    return {
      tone: "neutral",
      professionalism: "neutral",
      meaningful: false,
      delta: 0,
      reason: "empty",
      signals: [],
    };
  }

  const lower = text.toLowerCase();
  const tokens = tokenize(text);
  const wordCount = tokens.length;

  // ── Hard-veto signals — these short-circuit everything else
  const risky = containsAny(lower, RISKY);
  if (risky) {
    return finalize([
      { intent: "rude", delta: -0.4, reason: `risky language ("${risky}")` },
    ], "risky", "risky", false);
  }

  const rude = containsAny(lower, UNPROFESSIONAL);
  if (rude) {
    return finalize([
      {
        intent: "rude",
        delta: -0.25,
        reason: `unprofessional ("${rude}")`,
      },
    ], "unprofessional", "unprofessional", false);
  }

  if (isOnlyEmoji(text)) {
    return finalize([
      { intent: "lazy_ack", delta: -0.1, reason: "emoji-only reply" },
    ], "lazy", "informal", false);
  }

  // Lazy single/double-token ack
  if (wordCount <= 2 && tokens.every((t) => LAZY_TOKENS.has(t))) {
    return finalize([
      { intent: "lazy_ack", delta: -0.1, reason: "low-effort reply" },
    ], "lazy", "informal", false);
  }
  if (wordCount === 1) {
    return finalize([
      { intent: "lazy_ack", delta: -0.08, reason: "one-word reply" },
    ], "lazy", "informal", false);
  }

  // Shouting (mostly uppercase, > 7 chars) without expletives → mild negative
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 8 && letters === letters.toUpperCase()) {
    return finalize([
      { intent: "shouting", delta: -0.1, reason: "shouting (all caps)" },
    ], "unprofessional", "unprofessional", false);
  }

  // ── Multi-signal accumulation
  const signals: Signal[] = [];
  for (const p of PATTERNS) {
    const m = p.re.exec(lower);
    if (m) {
      signals.push({
        intent: p.intent,
        delta: p.delta,
        reason: p.reason,
        match: m[0],
      });
    }
  }
  const deduped = pickHighestPerIntent(signals);

  // ── Length / substance bonus
  if (wordCount >= 14) {
    deduped.push({
      intent: "report",
      delta: 0.06 + Math.min(0.08, wordCount / 400),
      reason: "substantive message",
    });
  } else if (wordCount >= 8) {
    deduped.push({
      intent: "report",
      delta: 0.04,
      reason: "engaged message",
    });
  }

  // Re-dedupe in case the length bonus collided with a real `report` signal
  const finalSignals = pickHighestPerIntent(deduped);

  // No signals + short message → neutral, slight negative for low effort
  if (finalSignals.length === 0) {
    if (wordCount <= 4) {
      return finalize([
        { intent: "lazy_ack", delta: -0.04, reason: "brief, low-signal reply" },
      ], "lazy", "informal", false);
    }
    return finalize([
      { intent: "report", delta: 0.02, reason: "active participation" },
    ], "neutral", "neutral", false);
  }

  // Determine tone tier from the dominant positive signal
  const totalRaw = finalSignals.reduce((acc, s) => acc + s.delta, 0);
  const total = Math.max(-0.45, Math.min(0.45, totalRaw));
  const meaningful =
    total > 0.05 ||
    finalSignals.some((s) =>
      s.intent === "completion" ||
      s.intent === "commitment" ||
      s.intent === "report",
    );

  let tone: Tone;
  let prof: ToneResult["professionalism"];
  if (total >= 0.2) {
    tone = "substantive";
    prof = "professional";
  } else if (total >= 0.08) {
    tone = "engaged";
    prof = "professional";
  } else if (total <= -0.08) {
    tone = "unprofessional";
    prof = "unprofessional";
  } else if (total <= 0) {
    tone = "lazy";
    prof = "informal";
  } else {
    tone = "neutral";
    prof = "neutral";
  }

  // Sort signals: positives first by magnitude, negatives last
  finalSignals.sort((a, b) => b.delta - a.delta);
  const reason = finalSignals.map((s) => s.reason).join(" · ");

  return { tone, professionalism: prof, meaningful, delta: total, reason, signals: finalSignals };
}

function finalize(
  signals: Signal[],
  tone: Tone,
  professionalism: ToneResult["professionalism"],
  meaningful: boolean,
): ToneResult {
  const total = signals.reduce((acc, s) => acc + s.delta, 0);
  return {
    tone,
    professionalism,
    meaningful,
    delta: total,
    reason: signals.map((s) => s.reason).join(" · "),
    signals,
  };
}

export function deltaCopy(delta: number): string {
  if (Math.abs(delta) < 0.005) return "0.00°C";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}°C`;
}

export function toneColor(tone: Tone): string {
  switch (tone) {
    case "risky":
      return "#fca5a5";
    case "unprofessional":
      return "#f87171";
    case "lazy":
      return "#fbbf24";
    case "neutral":
      return "#cbd5e1";
    case "engaged":
      return "#86efac";
    case "substantive":
      return "#34d399";
  }
}

export function toneIcon(tone: Tone): string {
  switch (tone) {
    case "risky":
      return "⛔";
    case "unprofessional":
      return "⚠️";
    case "lazy":
      return "💤";
    case "neutral":
      return "·";
    case "engaged":
      return "✓";
    case "substantive":
      return "★";
  }
}

export function intentLabel(intent: Intent): string {
  switch (intent) {
    case "completion":
      return "Completion";
    case "commitment":
      return "Commitment";
    case "blocker":
      return "Blocker flagged";
    case "question":
      return "Question";
    case "help_offer":
      return "Help offered";
    case "praise":
      return "Recognition";
    case "complaint":
      return "Complaint";
    case "social":
      return "Off-topic";
    case "lazy_ack":
      return "Low effort";
    case "rude":
      return "Unprofessional";
    case "shouting":
      return "Shouting";
    case "report":
      return "Update";
  }
}
