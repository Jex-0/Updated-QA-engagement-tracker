import type { ChecklistItem, EventType } from "./types";

/**
 * QA engagement checklist — preserved 1:1 from the original application
 * so existing scoring and history remain comparable.
 */
export const ENGAGEMENT_ITEMS: ChecklistItem[] = [
  { category: "Greeting", phrase: "Good day, you are through to __________ from Capitec Bank. How can I help you today?" },
  { category: "Verification", phrase: "Please confirm your ID number or your account number." },
  { category: "Telco_IAC", phrase: "Did you know, in future you can call us via the app? It costs you nothing." },
  { category: "Adding Value", phrase: "Did you know..." },
  { category: "Empathy", phrase: "I hear you. / I appreciate you calling in today." },
  { category: "Probing", phrase: "Just to make sure I understand... / Are you saying...?" },
  { category: "Keeping Client Informed", phrase: "I will confirm the next steps shortly. / I'll keep you updated." },
  { category: "Recap_and_Summarise", phrase: "To summarise what I've done is... / To recap what I've done is..." },
  { category: "Active Listening", phrase: "Thank you for confirming." },
  { category: "Additional Assistance", phrase: "Is there anything else I can assist you with?" },
  { category: "Call Closing", phrase: "Thank you, goodbye." },
];

export const PULSE_LABEL = "Pulse";
export const PULSE_PROMPT = "Tick this when Pulse has been adopted or completed during the engagement.";

/** Keyword phrases used by the live speech assistant to auto-tick checklist items. */
export const KEYWORD_MAP: Record<string, string[]> = {
  Greeting: ["capitec bank", "how can i help", "good day", "good morning", "good afternoon", "good evening"],
  Verification: ["id number", "account number", "confirm your id", "verify your"],
  Telco_IAC: ["via the app", "banking app", "costs you nothing", "call us via"],
  "Adding Value": ["did you know"],
  Empathy: ["i hear you", "appreciate you calling", "i understand how"],
  Probing: ["just to make sure", "are you saying", "if i understand correctly", "so what you're saying"],
  "Keeping Client Informed": ["keep you updated", "confirm the next steps", "keep you posted", "keep you informed"],
  Recap_and_Summarise: ["to summarise", "to summarize", "to recap"],
  "Active Listening": ["thank you for confirming", "thanks for confirming", "thank you for that"],
  "Additional Assistance": ["anything else i can assist", "anything else i can help", "is there anything else"],
  "Call Closing": ["thank you, goodbye", "thank you goodbye", "have a great day", "goodbye"],
};

/** Maps a checklist category to the timeline event type shown in engagement timelines. */
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

/** Short, timeline-friendly label for a checklist category. */
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
      return category;
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

export const TOTAL_ITEMS = ENGAGEMENT_ITEMS.length;
