import type { ChecklistCategory, EventType, Phrase } from "./types";

/**
 * Default QA checklist — preserved 1:1 from the original application
 * (11 categories, one phrase each) so existing scoring and history stay
 * comparable. Managers can add, edit and remove categories and phrases;
 * the checklist is stored in app state and customised per workspace.
 */
export const DEFAULT_CATEGORIES: ChecklistCategory[] = [
  { id: "greeting", name: "Greeting" },
  { id: "verification", name: "Verification" },
  { id: "telco-iac", name: "Telco_IAC" },
  { id: "adding-value", name: "Adding Value" },
  { id: "empathy", name: "Empathy" },
  { id: "probing", name: "Probing" },
  { id: "keeping-informed", name: "Keeping Client Informed" },
  { id: "recap", name: "Recap_and_Summarise" },
  { id: "active-listening", name: "Active Listening" },
  { id: "additional-assistance", name: "Additional Assistance" },
  { id: "call-closing", name: "Call Closing" },
];

export const DEFAULT_PHRASES: Phrase[] = [
  {
    id: "p-greeting",
    categoryId: "greeting",
    text: "Good day, you are through to __________ from Capitec Bank. How can I help you today?",
    keywords: ["capitec bank", "how can i help", "good day", "good morning", "good afternoon", "good evening"],
    alternatives: [
      "Good morning, thank you for calling Capitec Bank.",
      "Good afternoon, you're through to Capitec Bank.",
      "Good day, thanks for holding.",
      "Good evening, welcome to Capitec Bank.",
    ],
  },
  {
    id: "p-verification",
    categoryId: "verification",
    text: "Please confirm your ID number or your account number.",
    keywords: ["id number", "account number", "confirm your id", "verify your"],
    alternatives: [
      "May I please confirm your ID number?",
      "Can I verify your account details?",
      "Please confirm your date of birth for security.",
    ],
  },
  {
    id: "p-telco-iac",
    categoryId: "telco-iac",
    text: "Did you know, in future you can call us via the app? It costs you nothing.",
    keywords: ["via the app", "banking app", "costs you nothing", "call us via"],
    alternatives: [
      "Did you know you can reach us on the app?",
      "You can also WhatsApp us on the app.",
      "Have you tried the Capitec app for future queries?",
    ],
  },
  {
    id: "p-adding-value",
    categoryId: "adding-value",
    text: "Did you know...",
    keywords: ["did you know"],
    alternatives: ["Just a tip — ", "You may not be aware, but ", "One thing to note — "],
  },
  {
    id: "p-empathy",
    categoryId: "empathy",
    text: "I hear you. / I appreciate you calling in today.",
    keywords: ["i hear you", "appreciate you calling", "i understand how"],
    alternatives: [
      "I understand how frustrating that must be.",
      "Thank you for your patience.",
      "I can see why that would be upsetting.",
    ],
  },
  {
    id: "p-probing",
    categoryId: "probing",
    text: "Just to make sure I understand... / Are you saying...?",
    keywords: ["just to make sure", "are you saying", "if i understand correctly", "so what you're saying"],
    alternatives: [
      "Can you tell me a bit more about that?",
      "What happened exactly?",
      "To clarify, you're experiencing...?",
    ],
  },
  {
    id: "p-keeping-informed",
    categoryId: "keeping-informed",
    text: "I will confirm the next steps shortly. / I'll keep you updated.",
    keywords: ["keep you updated", "confirm the next steps", "keep you posted", "keep you informed"],
    alternatives: [
      "I'll let you know as soon as I have an update.",
      "I'll send you an SMS once it's done.",
      "You can expect a callback within 24 hours.",
    ],
  },
  {
    id: "p-recap",
    categoryId: "recap",
    text: "To summarise what I've done is... / To recap what I've done is...",
    keywords: ["to summarise", "to summarize", "to recap"],
    alternatives: [
      "So, to recap what we've done today…",
      "Just to summarise the steps we've taken…",
      "In summary, what I've done for you is…",
    ],
  },
  {
    id: "p-active-listening",
    categoryId: "active-listening",
    text: "Thank you for confirming.",
    keywords: ["thank you for confirming", "thanks for confirming", "thank you for that"],
    alternatives: ["Thanks for that information.", "I appreciate you sharing that.", "Noted, thank you."],
  },
  {
    id: "p-additional-assistance",
    categoryId: "additional-assistance",
    text: "Is there anything else I can assist you with?",
    keywords: ["anything else i can assist", "anything else i can help", "is there anything else"],
    alternatives: [
      "Can I help you with anything else today?",
      "Is there anything else you need?",
      "Will that be all for today?",
    ],
  },
  {
    id: "p-call-closing",
    categoryId: "call-closing",
    text: "Thank you, goodbye.",
    keywords: ["thank you, goodbye", "thank you goodbye", "have a great day", "goodbye"],
    alternatives: ["Thank you for calling, goodbye.", "Have a wonderful day.", "Thank you, take care."],
  },
];

export const PULSE_LABEL = "Pulse";
export const PULSE_PROMPT = "Tick this when Pulse has been adopted or completed during the engagement.";

/** Keyword map for the speech assistant: phrase id → trigger phrases. */
export function buildKeywordMap(phrases: Phrase[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const p of phrases) {
    if (p.keywords.length) map[p.id] = p.keywords;
  }
  return map;
}

/* ------------------------- resolution helpers ------------------------- */
/* Records store phrase ids. Legacy records (original app / older versions) */
/* store category names — these helpers resolve both.                    */

export function phraseById(phrases: Phrase[], id: string): Phrase | null {
  return phrases.find((p) => p.id === id) ?? null;
}

export function categoryById(categories: ChecklistCategory[], id: string): ChecklistCategory | null {
  return categories.find((c) => c.id === id) ?? null;
}

/**
 * Resolve a stored item id to a phrase. Matches phrase ids first, then category
 * ids, then legacy category names (the first phrase of that category) — so
 * historical records from the original app still resolve.
 */
export function resolvePhrase(
  categories: ChecklistCategory[],
  phrases: Phrase[],
  idOrCategory: string,
): Phrase | null {
  const byId = phraseById(phrases, idOrCategory);
  if (byId) return byId;
  const cat =
    categoryById(categories, idOrCategory) ?? categories.find((c) => c.name === idOrCategory) ?? null;
  if (cat) return phrases.find((p) => p.categoryId === cat.id) ?? null;
  return null;
}

/** Display label for a stored item: category name for phrases, itself for legacy names. */
export function resolveCategoryLabel(
  categories: ChecklistCategory[],
  phrases: Phrase[],
  idOrCategory: string,
): string {
  const phrase = resolvePhrase(categories, phrases, idOrCategory);
  if (phrase) {
    return categoryById(categories, phrase.categoryId)?.name ?? phrase.categoryId;
  }
  return idOrCategory;
}

/** Phrase text for a stored item (legacy names render as their category name). */
export function resolvePhraseText(
  categories: ChecklistCategory[],
  phrases: Phrase[],
  idOrCategory: string,
): string {
  const phrase = resolvePhrase(categories, phrases, idOrCategory);
  if (phrase) return phrase.text;
  return idOrCategory;
}

/** Maps a checklist category name to the timeline event type. */
export function categoryEventType(category: string): EventType {
  switch (category) {
    case "Greeting":
      return "greeting";
    case "Empathy":
    case "Active Listening":
      return "empathy";
    case "Verification":
    case "Keeping Client Informed":
    case "Recap_and_Summarise":
      return "compliance";
    case "Probing":
      return "objection";
    case "Telco_IAC":
    case "Adding Value":
      return "upsell";
    default:
      return "quality";
  }
}

/** Short, timeline-friendly label for a category name. */
export function categoryEventLabel(category: string): string {
  switch (category) {
    case "Greeting":
      return "Greeting detected";
    case "Verification":
      return "Verification requested";
    case "Telco_IAC":
      return "Digital channel promoted";
    case "Adding Value":
      return "Value-add offered";
    case "Empathy":
      return "Empathy statement detected";
    case "Probing":
      return "Objection handled";
    case "Keeping Client Informed":
      return "Client kept informed";
    case "Recap_and_Summarise":
      return "Call summarised";
    case "Active Listening":
      return "Active listening detected";
    case "Additional Assistance":
      return "Additional assistance offered";
    case "Call Closing":
      return "Call closed professionally";
    default:
      return `${category} demonstrated`;
  }
}

/** Coaching wording used for a category that was missed during a call. */
export function missedOpportunityLabel(category: string): string {
  switch (category) {
    case "Greeting":
      return "Standard greeting missed";
    case "Verification":
      return "Verification not requested";
    case "Telco_IAC":
      return "Upsell opportunity missed";
    case "Adding Value":
      return "Value-add opportunity missed";
    case "Empathy":
      return "Empathy opportunity missed";
    case "Probing":
      return "Objection not explored";
    case "Keeping Client Informed":
      return "Client not kept informed";
    case "Recap_and_Summarise":
      return "Call not summarised";
    case "Active Listening":
      return "Active listening not demonstrated";
    case "Additional Assistance":
      return "Additional assistance not offered";
    case "Call Closing":
      return "Call not closed professionally";
    default:
      return `${category} not demonstrated`;
  }
}

/** Coaching guidance for a missed category name. */
export function coachingForCategory(category: string): string {
  switch (category) {
    case "Greeting":
      return "Reinforce the standard opening script; role-play the greeting until it becomes automatic.";
    case "Verification":
      return "Always confirm the caller's identity before sharing any account detail.";
    case "Telco_IAC":
    case "Adding Value":
      return "Practise a value-add sentence after resolving the query (e.g. 'Did you know…').";
    case "Empathy":
      return "Use a reflective empathy phrase such as 'I hear you' early in difficult calls.";
    case "Probing":
      return "Ask one clarifying question before offering a solution to reduce repeat contact.";
    case "Keeping Client Informed":
      return "Set explicit expectations: 'I will confirm the next steps shortly.'";
    case "Recap_and_Summarise":
      return "Close the loop by summarising what was done before ending the call.";
    case "Active Listening":
      return "Acknowledge customer confirmations verbally ('Thank you for confirming').";
    case "Additional Assistance":
      return "Always offer additional assistance before closing the call.";
    case "Call Closing":
      return "End every call with a professional closing and goodbye.";
    default:
      return `Review the ${category} step with the agent.`;
  }
}
