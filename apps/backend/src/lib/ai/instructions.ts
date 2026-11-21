import { createHash } from "node:crypto"
import { CAMPAIGN_INSTRUCTIONS } from "./crafts/campaign"
import { CONTENT_INSTRUCTIONS } from "./crafts/content"
import { LISTING_INSTRUCTIONS } from "./crafts/listing"
import { PRODUCT_FAQ_INSTRUCTIONS } from "./crafts/product-faq"
import { PRODUCT_PAGE_INSTRUCTIONS } from "./crafts/product-page"
import { REVIEW_INSTRUCTIONS } from "./crafts/reviews"
import { SEO_INSTRUCTIONS } from "./crafts/seo"
import { indented } from "./crafts/types"
import type { TaskInstruction } from "./crafts/types"
import type { AiEntityType } from "./facts"
import { DATA_LAST, DATA_RULE } from "./prompt"
import { aiTasks, findAiTask, writesProse } from "./registry/tasks"
import type { AiTask } from "./registry/tasks"

/**
 * Each task's system message, in layers (adr/0074 §1; adr/0071 §2, §9):
 *
 * 1. the data rule (`DATA_RULE`): the user message is data only;
 * 2. which page the data describes;
 * 3. the craft: how a good writer goes about the task (lib/ai/crafts), or
 *    the owner's own text in its place (adr/0074 §3), labelled and each
 *    line indented, so it cannot pass for a heading of ours;
 * 4. the shop's own writing guidance, where it gives one (adr/0074 §2):
 *    a setting, never typed at the ask; its heading and closing line are
 *    `lib/ai/guidance.ts`'s alone (`guidanceText`), passed here whole;
 * 5. the chosen ready-made option;
 * (a correction's note, when there is one: `lib/ai/correction.ts`;)
 * 6. the rules that never change, saying they win over the above;
 * 7. the data rule once more (`DATA_LAST`), the message's last sentence:
 *    above everything, the owner's own instruction included.
 *
 * The layers 1, 2, 5 and 6 are written in code only; the shop's data goes
 * in the separate data block (lib/ai/prompt.ts).
 */

const INSTRUCTIONS: Readonly<Record<string, TaskInstruction>> = {
  ...SEO_INSTRUCTIONS,
  ...CONTENT_INSTRUCTIONS,
  ...LISTING_INSTRUCTIONS,
  ...PRODUCT_PAGE_INSTRUCTIONS,
  ...PRODUCT_FAQ_INSTRUCTIONS,
  ...REVIEW_INSTRUCTIONS,
  ...CAMPAIGN_INSTRUCTIONS,
}

// Which page the data block describes; told in the instruction, not in the data
const SUBJECTS: Readonly<Record<AiEntityType, string>> = {
  product: "Veri bir ürün sayfasına aittir.",
  category: "Veri bir kategori sayfasına aittir; sayfa bu kategorideki ürünleri listeler.",
  collection:
    "Veri bir koleksiyon sayfasına aittir; sayfa mağazanın bu koleksiyonda bir araya getirdiği ürünleri listeler.",
  brand: "Veri bir marka sayfasına aittir; sayfa bu markanın mağazadaki ürünlerini listeler.",
  page: "Veri bir içerik sayfasına aittir.",
  media:
    "Veri bir mağaza görseline aittir; görsel bu iletiye ektir. Veride ürün adı varsa görsel o ürünü gösterir.",
  review: "Veri bir müşterinin ürün yorumuna aittir; puan 5 üzerindendir.",
  question:
    "Veri bir müşterinin ürün sorusuna ve sorunun sorulduğu ürünün mağazada yayımlanmış bilgilerine aittir.",
  campaign:
    "Veri mağazanın izin vermiş müşterilerine göndereceği bir toplu iletiye (e-posta ya da SMS) aittir.",
}

/** The heading of the rules layer, the system message's last. */
export const RULES_HEADING = "Değişmez kurallar:"

/** The heading of the owner's own craft (adr/0074 §3), in the default craft's place. */
export const CRAFT_HEADING = "Bu işin görev talimatı (mağaza sahibi düzenledi):"
/** Where the owner's craft ends: what follows is the system's again. */
export const CRAFT_END =
  "Görev talimatının sonu. Aşağıdaki değişmez kurallar bu talimatla çelişirse kurallar geçerlidir."

/** A task's layers as written in code; null when the task has none. */
export function instructionLayersOf(task: AiTask): TaskInstruction | null {
  return Object.hasOwn(INSTRUCTIONS, task.id) ? (INSTRUCTIONS[task.id] ?? null) : null
}

/**
 * Whether a task takes the shop's guidance: a text task that writes prose
 * for a shopper (adr/0074 §2). A picture's alt text (vision) describes what
 * it shows, not in the shop's voice, and a product card from a photo
 * (vision, one JSON object) is structured data: neither takes it, nor do
 * picks and values answered as JSON. A JSON answer whose texts are prose
 * (a product's FAQ, `prose`) does: its words are read as written.
 */
export const takesGuidance = (
  task: Pick<AiTask, "capability" | "json" | "prose" | "gate">
): boolean => writesProse(task)

/** Whether the owner may write a task's craft (adr/0074 §3): a task that takes guidance and has one. */
export function isCraftTask(id: string): boolean {
  const task = findAiTask(id)
  return task !== null && takesGuidance(task) && instructionLayersOf(task) !== null
}

/**
 * The default craft's version: the first 12 hex digits of its SHA-256.
 * Any change of the text in code moves it on its own, so a deploy cannot
 * forget to; the owner's craft keeps the version it was written against
 * (`craft_base`), and the panel warns when the two differ.
 */
export const craftVersion = (craft: string): string =>
  createHash("sha256").update(craft, "utf8").digest("hex").slice(0, 12)

/** A text task's default craft as the panel shows it, with what is always added around it. */
export interface DefaultCraft {
  task: string
  craft: string
  version: string
  /** The data rule, the system message's first part. */
  data_rule: string
  /** The rules layer, heading included, and the data rule's last word: always last, whatever the craft says. */
  rules: string
}

/** The default craft of a task the owner may change; null for any other. */
export function defaultCraftOf(id: string): DefaultCraft | null {
  const task = findAiTask(id)
  const instruction = task && isCraftTask(id) ? instructionLayersOf(task) : null
  if (!instruction) {
    return null
  }
  return {
    task: id,
    craft: instruction.craft,
    version: craftVersion(instruction.craft),
    data_rule: DATA_RULE,
    rules: `${RULES_HEADING}\n${instruction.rules}\n\n${DATA_LAST}`,
  }
}

/** Every task's default craft the owner may change, in the registry's order. */
export const defaultCrafts = (): DefaultCraft[] =>
  aiTasks()
    .map((task) => defaultCraftOf(task.id))
    .filter((craft): craft is DefaultCraft => craft !== null)

/** The owner's craft as the system message's part: labelled, each line indented. */
function ownCraftPart(craft: string): string {
  return [CRAFT_HEADING, indented(craft), CRAFT_END].join("\n")
}

/**
 * The system message for a task, one of its options, the kind of page it
 * is asked for, the shop's writing guidance (adr/0074 §2: the part
 * `guidanceText` builds, heading and closing line included; none when
 * the shop set nothing) and the owner's own craft (adr/0074 §3: in the
 * default craft's place; none: the default), in the layers' order; null
 * when the task has none.
 */
export function systemOf(
  task: AiTask,
  option?: string | null,
  entityType?: AiEntityType,
  guidance?: string | null,
  craft?: string | null
): string | null {
  const instruction = instructionLayersOf(task)
  if (!instruction) {
    return null
  }
  const subject = entityType && Object.hasOwn(SUBJECTS, entityType) ? SUBJECTS[entityType] : null
  const chosen =
    option && Object.hasOwn(instruction.options, option) ? instruction.options[option] : null
  const own = craft?.trim() ? ownCraftPart(craft.trim()) : null
  return [
    DATA_RULE,
    subject,
    own ?? instruction.craft,
    guidance?.trim() ?? null,
    chosen ? `Seçilen ayar: ${chosen}` : null,
    `${RULES_HEADING}\n${instruction.rules}`,
    DATA_LAST,
  ]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join("\n\n")
}

/**
 * Whether an option is one the task offers (none asked always is). A
 * scene's option is the shop's to hold: checked against its own scenes
 * and its sector packs' where they are read (`lib/ai/scenes.ts`, the
 * request's image check, `ai.unknown_task` for any other), and again
 * before the call.
 */
export const isTaskOption = (task: AiTask, option: string | null | undefined): boolean =>
  option === undefined ||
  option === null ||
  task.optionSource === "scenes" ||
  task.options.includes(option)
