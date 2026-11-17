import { MIN_PRODUCT_WORDS } from "../seo/advisor"
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

// A description's word targets: never under the advisor's floor (`MIN_PRODUCT_WORDS`, the gate's too)
const WORDS = {
  min: MIN_PRODUCT_WORDS,
  short: Math.round(MIN_PRODUCT_WORDS * 1.4),
  usual: MIN_PRODUCT_WORDS * 2,
  detailed: MIN_PRODUCT_WORDS * 3,
}

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
  product_description: {
    base: `Bu ürün için mağazanın ürün sayfasında görünecek özgün bir ürün açıklaması yaz. En az ${String(WORDS.min)}, en çok ${String(WORDS.usual)} sözcük olsun. Ürünün ne olduğunu, öne çıkan özelliklerini ve nasıl kullanıldığını anlat; verideki nitelikleri kullan. Yalnızca verideki bilgileri kullan; veride olmayan özellik, ölçü, malzeme, fiyat, indirim, kargo, garanti ya da üstünlük iddiası ekleme. Düz metin yaz: iki ya da daha fazla paragraf, paragraflar arasında boş satır; başlık, liste imi, HTML, tırnak, emoji, bağlantı ve tümü büyük harf sözcük kullanma. Türkçe yaz. Yalnızca açıklama metnini yaz.`,
    options: {
      short: `Kısa tut: en az ${String(WORDS.min)}, en çok ${String(WORDS.short)} sözcük, iki paragraf.`,
      detailed: `Ayrıntılı yaz: ${String(WORDS.usual)} ile ${String(WORDS.detailed)} sözcük arasında (bu uzunluk yukarıdaki üst sınırın yerine geçer); kullanım ve bakım bilgisini veride varsa ayrı paragrafta anlat.`,
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
