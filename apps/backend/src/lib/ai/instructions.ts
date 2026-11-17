import { SERP_TEXT_LENGTH } from "../seo/pixel-width"
import type { AiEntityType } from "./facts"
import type { AiTask } from "./registry/tasks"

/**
 * Each task's fixed instruction and its options' (adr/0071 §2): what the
 * system message says. Written here only, never typed by a person; the
 * shop's data goes in the separate data block (lib/ai/prompt.ts). Free of
 * any trade: a shop's own words come from its data alone. Length targets
 * are the advisor's (`SERP_TEXT_LENGTH`), never typed twice.
 */

interface TaskInstruction {
  base: string
  options: Readonly<Record<string, string>>
}

const { title, description } = SERP_TEXT_LENGTH

// What every search result text keeps to: the shop's own facts, plain, and nothing made up
const SEO_RULES =
  "Yalnızca verideki bilgileri kullan; veride olmayan özellik, fiyat, indirim, kargo ya da üstünlük iddiası ekleme. Tek satır, düz metin yaz: tırnak, emoji, köşeli ya da açılı ayraç, bağlantı ve tümü büyük harf sözcük kullanma. Türkçe yaz."

const INSTRUCTIONS: Readonly<Record<string, TaskInstruction>> = {
  seo_title: {
    base: `Bu sayfa için arama sonuçlarında görünecek bir başlık yaz. Uzunluğu ${String(title.min)} ile ${String(title.max)} karakter arasında olsun. Sayfanın ne olduğunu başta söyle; bir sözcüğü iki kez kullanma. Mağaza adı veride varsa ve sığıyorsa sona "| Mağaza adı" biçiminde ekleyebilirsin. ${SEO_RULES} Yalnızca başlığı yaz.`,
    options: {},
  },
  seo_description: {
    base: `Bu sayfa için arama sonuçlarında başlığın altında görünecek bir açıklama yaz. Uzunluğu ${String(description.min)} ile ${String(description.max)} karakter arasında olsun. Bir ya da iki cümleyle sayfada ne bulunacağını anlat ve okuru sayfaya davet et. ${SEO_RULES} Yalnızca açıklamayı yaz.`,
    options: {
      short: `Uzunluğu ${String(description.min)} karaktere yakın tut; tek cümle yeter.`,
    },
  },
  test_text: {
    base: "Verilen ürün bilgisinden tek cümlelik, düz metin bir tanım yaz.",
    options: {
      plain: "Sade ve kısa yaz.",
      detailed: "Ürünün özelliklerini de an.",
    },
  },
}

// Which page the data block describes; told in the instruction, not in the data
const SUBJECTS: Readonly<Record<AiEntityType, string>> = {
  product: "Veri bir ürün sayfasına aittir.",
  category: "Veri bir kategori sayfasına aittir; sayfa bu kategorideki ürünleri listeler.",
  page: "Veri bir içerik sayfasına aittir.",
}

/**
 * The instruction for a task, one of its options and the kind of page it
 * is asked for; null when the task has none.
 */
export function instructionOf(
  task: AiTask,
  option?: string | null,
  entityType?: AiEntityType
): string | null {
  const instruction = INSTRUCTIONS[task.id]
  if (!instruction) {
    return null
  }
  const subject = entityType && Object.hasOwn(SUBJECTS, entityType) ? SUBJECTS[entityType] : null
  const extra =
    option && Object.hasOwn(instruction.options, option) ? instruction.options[option] : null
  return [subject, instruction.base, extra].filter((part) => !!part).join(" ")
}

/** Whether an option is one the task offers (none asked always is). */
export const isTaskOption = (task: AiTask, option: string | null | undefined): boolean =>
  option === undefined || option === null || task.options.includes(option)
