import { AI_CANDIDATE_COUNT, AI_TEMPERATURE } from "./catalog-tasks"
import type { AiTask } from "./tasks"

// --- adr/0074 §5 madde 6: a bulk message's words (adr/0050) ---

/**
 * What the message is for, picked before asking (adr/0074 Ek 2026-11-22 (8)):
 * a closed list, never typed. More than a tone's two choices: a purpose
 * is the message's subject, not its voice, so it is a list of its own
 * (`optionKind: "purpose"`), as long as `MAX_PURPOSE_OPTIONS`.
 */
export const CAMPAIGN_PURPOSES = ["new_product", "discount", "season", "win_back"] as const
export type CampaignPurpose = (typeof CAMPAIGN_PURPOSES)[number]

/** The longest list of purposes a task offers. */
export const MAX_PURPOSE_OPTIONS = 4

/** Subject lines asked for in one call: the short texts' candidates (adr/0074 §4). */
export const CAMPAIGN_SUBJECT_COUNT = AI_CANDIDATE_COUNT

/** The longest subject offered: an inbox shows some 60; the field takes 120 (`AdminUpdateCampaign`). */
export const CAMPAIGN_SUBJECT_MAX_LENGTH = 90

/** The longest preview line offered; the field takes 150. */
export const CAMPAIGN_PREHEADER_MAX_LENGTH = 140

/** The body's paragraphs: a short e-mail, read in a glance. */
export const CAMPAIGN_PARAGRAPHS = { min: 1, max: 4 } as const

/** The longest paragraph, in characters. */
export const CAMPAIGN_PARAGRAPH_MAX_LENGTH = 600

/** The body's words, asked and held: short, never a page. */
export const CAMPAIGN_BODY_WORDS = { min: 25, target: 90, max: 220 } as const

/** How much of the e-mail's body now goes (its words only, cards and links left out). */
export const CAMPAIGN_BODY_FACT_LENGTH = 1_200

/** The data block's field the e-mail's product names go in (lib/ai/facts/campaign.ts). */
export const CAMPAIGN_PRODUCTS_FIELD = "products"

/** The data block's field saying how long a text may be (workflows/ai/steps/campaign-input.ts). */
export const CAMPAIGN_SMS_ROOM_FIELD = "sms_max_chars"

/** The whole e-mail answer, in characters: three subjects, a preview line and the body as JSON. */
export const CAMPAIGN_EMAIL_MAX_LENGTH = 3_200

/** Texts asked for in one call. */
export const CAMPAIGN_SMS_COUNT = AI_CANDIDATE_COUNT

/**
 * The longest text: one GSM part (155 septets with the Turkish table,
 * lib/campaigns/sms.ts). What really counts is the text with the shop's
 * name and the opt-out line after it, in one part: the gate holds that.
 */
export const CAMPAIGN_SMS_MAX_LENGTH = 155

// The bulk messages' writers (lib/staff/permissions.ts `bulkMessages`): owner and admin
const CAMPAIGN_TASK_BASE = {
  capability: "text",
  mode: "sync",
  options: CAMPAIGN_PURPOSES,
  optionKind: "purpose",
  roles: ["owner", "admin"],
  credits: 1,
  entities: ["campaign"],
  factMaxLengths: { body: CAMPAIGN_BODY_FACT_LENGTH },
  json: true,
  prose: true,
} as const satisfies Partial<AiTask>

/**
 * A bulk e-mail's words (adr/0074 §5 madde 6): three subject lines, a
 * preview line and a short body, one JSON object; each text through the
 * shared gate, and no price or figure the data does not hold. Read from
 * the stored campaign alone: its name, the subject and words written so
 * far, and the names of the published storefront products it shows as
 * cards. Never its audience, a recipient, a count of them or an order.
 * Nothing is saved: the editor takes what is picked as an unsaved change.
 */
export const CAMPAIGN_EMAIL_TASK: AiTask = {
  ...CAMPAIGN_TASK_BASE,
  id: "campaign_email",
  gate: "campaign_email",
  maxLength: CAMPAIGN_EMAIL_MAX_LENGTH,
  temperature: AI_TEMPERATURE.long,
}

/**
 * A bulk text's words: three texts, each fitting one SMS with the end the
 * backend adds to every text (the shop's name and the opt-out line),
 * counted as the send counts it. Offered as candidates, one picked.
 */
export const CAMPAIGN_SMS_TASK: AiTask = {
  ...CAMPAIGN_TASK_BASE,
  id: "campaign_sms",
  gate: "campaign_sms",
  maxLength: CAMPAIGN_SMS_MAX_LENGTH,
  candidates: CAMPAIGN_SMS_COUNT,
  temperature: AI_TEMPERATURE.short,
}
