import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import {
  AI_GUIDANCE_DEFAULTS,
  type AiAddress,
  type AiGuidanceSettings,
  type AiTone,
} from "../../modules/platform-settings/sections/ai-guidance"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/**
 * The shop's writing guidance as a part of a task's system message
 * (adr/0074 §1, §2): after the task's craft, before its option and the
 * fixed rules, which come last and win over it. Labelled as the shop's,
 * so the model reads it as a style setting, not as data or as a new task.
 * The tone and the address are the server's own sentences; what the shop
 * typed was held by the section (`ai_guidance`) before it was stored.
 */

export const GUIDANCE_HEADING = "Mağazanın yazım yönergesi:"
/** Where the shop's part ends: what follows is the system's again. */
export const GUIDANCE_END = "Mağazanın yazım yönergesinin sonu."

// Each word quoted: a word from the API carrying a comma or a colon stays one word, not a sentence
const quotedWords = (list: readonly string[]) => list.map((word) => `“${word}”`).join(", ")

const TONES: Record<AiTone, string> = {
  warm: "Samimi ama ölçülü yaz: sıcak ve içten, abartısız; laubali olma.",
  professional: "Profesyonel yaz: net, güven veren ve kurumsal; gereksiz süs ve ünlem kullanma.",
  expert:
    "Konusunu bilen bir uzman gibi yaz: bilgiyi doğru ve anlaşılır ver, teknik terimi gerektiğinde kısaca açıkla.",
  premium:
    "Seçkin ve zarif yaz: sakin, özenli, kaliteyi ve işçiliği öne çıkaran bir dil; ucuzluk ve indirim çağrışımından kaçın.",
  plain: "Sade yaz: kısa cümleler, gündelik sözcükler, süssüz anlatım.",
}

const ADDRESSES: Record<AiAddress, string> = {
  sen: "Okura “sen” diye hitap et (örneğin: keşfet, senin için).",
  siz: "Okura “siz” diye hitap et (örneğin: keşfedin, sizin için).",
  none: "Okura doğrudan hitap etme; ürünü ve faydasını üçüncü kişi diliyle anlat.",
}

/** A text the shop typed, each line under its label, so it cannot pass for a heading of ours. */
const indented = (text: string) =>
  text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")

const sameAsDefaults = (settings: AiGuidanceSettings) =>
  settings.tone === AI_GUIDANCE_DEFAULTS.tone &&
  settings.address === AI_GUIDANCE_DEFAULTS.address &&
  !settings.audience &&
  !settings.guide &&
  settings.prefer.length === 0 &&
  settings.avoid.length === 0

/**
 * The guidance for one task, as the system message's part, or null when
 * the shop set nothing (every field at its default and nothing for this
 * task): the task's own craft speaks alone then, as before the setting.
 */
export function guidanceText(settings: AiGuidanceSettings, taskId: string): string | null {
  const task = Object.hasOwn(settings.tasks, taskId) ? settings.tasks[taskId] : undefined
  const extra = task?.extra ?? null
  const examples = task?.examples ?? []
  if (sameAsDefaults(settings) && !extra && examples.length === 0) {
    return null
  }
  const lines = [
    GUIDANCE_HEADING,
    "Bu bölüm yalnızca üslubu belirler; veride olmayan bir bilgiyi yazmak için gerekçe değildir.",
    `- Ton: ${TONES[settings.tone]}`,
    `- Hitap: ${ADDRESSES[settings.address]}`,
  ]
  if (settings.audience) {
    lines.push(`- Hedef kitle: ${settings.audience}`)
  }
  if (settings.guide) {
    lines.push("- Mağazanın notu:", indented(settings.guide))
  }
  if (settings.prefer.length > 0) {
    lines.push(`- Uygun düştüğünde tercih edilecek sözcükler: ${quotedWords(settings.prefer)}`)
  }
  if (settings.avoid.length > 0) {
    lines.push(`- Hiç kullanılmayacak sözcükler: ${quotedWords(settings.avoid)}`)
  }
  if (extra) {
    lines.push("- Bu iş için ek yönerge:", indented(extra))
  }
  examples.forEach((example, index) => {
    lines.push(
      `- Örnek ${String(index + 1)} (ton ve yapı örneği; içeriğini kopyalama):`,
      indented(example)
    )
  })
  lines.push(GUIDANCE_END)
  return lines.join("\n")
}

/** The shop's guidance, defaults filled in (the settings cache). */
export async function readGuidance(
  container: Pick<MedusaContainer, "resolve">
): Promise<AiGuidanceSettings> {
  const values = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("ai_guidance")
  return values as unknown as AiGuidanceSettings
}

/** The system message's guidance part for a task, read from the shop's settings. */
export async function guidanceFor(
  container: Pick<MedusaContainer, "resolve">,
  taskId: string
): Promise<string | null> {
  return guidanceText(await readGuidance(container), taskId)
}
