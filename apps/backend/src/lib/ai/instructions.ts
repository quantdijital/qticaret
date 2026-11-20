import { CONTENT_INSTRUCTIONS } from "./crafts/content"
import { REVIEW_INSTRUCTIONS } from "./crafts/reviews"
import { SEO_INSTRUCTIONS } from "./crafts/seo"
import type { TaskInstruction } from "./crafts/types"
import type { AiEntityType } from "./facts"
import { DATA_RULE } from "./prompt"
import type { AiTask } from "./registry/tasks"

/**
 * Each task's system message, in layers (adr/0074 §1; adr/0071 §2, §9):
 *
 * 1. the data rule (`DATA_RULE`): the user message is data only;
 * 2. which page the data describes;
 * 3. the craft: how a good writer goes about the task (lib/ai/crafts);
 * 4. the shop's own writing guidance, where it gives one (adr/0074 §2):
 *    a setting, never typed at the ask; its heading and closing line are
 *    `lib/ai/guidance.ts`'s alone (`guidanceText`), passed here whole;
 * 5. the chosen ready-made option;
 * (a correction's note, when there is one: `lib/ai/correction.ts`;)
 * 6. the rules that never change, last, saying they win over the above.
 *
 * The layers 1–3, 5 and 6 are written in code; the shop's data goes in
 * the separate data block (lib/ai/prompt.ts).
 */

const INSTRUCTIONS: Readonly<Record<string, TaskInstruction>> = {
  ...SEO_INSTRUCTIONS,
  ...CONTENT_INSTRUCTIONS,
  ...REVIEW_INSTRUCTIONS,
}

// Which page the data block describes; told in the instruction, not in the data
const SUBJECTS: Readonly<Record<AiEntityType, string>> = {
  product: "Veri bir ürün sayfasına aittir.",
  category: "Veri bir kategori sayfasına aittir; sayfa bu kategorideki ürünleri listeler.",
  page: "Veri bir içerik sayfasına aittir.",
  media:
    "Veri bir mağaza görseline aittir; görsel bu iletiye ektir. Veride ürün adı varsa görsel o ürünü gösterir.",
  review: "Veri bir müşterinin ürün yorumuna aittir; puan 5 üzerindendir.",
  question:
    "Veri bir müşterinin ürün sorusuna ve sorunun sorulduğu ürünün mağazada yayımlanmış bilgilerine aittir.",
}

/** The heading of the rules layer, the system message's last. */
export const RULES_HEADING = "Değişmez kurallar:"

/** A task's layers as written in code; null when the task has none. */
export function instructionLayersOf(task: AiTask): TaskInstruction | null {
  return Object.hasOwn(INSTRUCTIONS, task.id) ? (INSTRUCTIONS[task.id] ?? null) : null
}

/**
 * The system message for a task, one of its options, the kind of page it
 * is asked for and the shop's writing guidance (adr/0074 §2: the part
 * `guidanceText` builds, heading and closing line included; none when
 * the shop set nothing), in the layers' order; null when the task has none.
 */
export function systemOf(
  task: AiTask,
  option?: string | null,
  entityType?: AiEntityType,
  guidance?: string | null
): string | null {
  const instruction = instructionLayersOf(task)
  if (!instruction) {
    return null
  }
  const subject = entityType && Object.hasOwn(SUBJECTS, entityType) ? SUBJECTS[entityType] : null
  const chosen =
    option && Object.hasOwn(instruction.options, option) ? instruction.options[option] : null
  return [
    DATA_RULE,
    subject,
    instruction.craft,
    guidance?.trim() ?? null,
    chosen ? `Seçilen ayar: ${chosen}` : null,
    `${RULES_HEADING}\n${instruction.rules}`,
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
