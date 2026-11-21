import { CAMPAIGN_SMS_ROOM_FIELD } from "../registry/campaign-tasks"

/**
 * The fake service's bulk message words (connectors/fake.ts): from the
 * campaign's name in the data block alone, the same every time, written
 * to pass the gate (lib/ai/campaign-text.ts) so the core's tests run on it.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const FAKE_PARAGRAPH =
  "Bu hafta mağazamızda sizin için hazırladığımız seçkiyi keşfetmeye davet ediyoruz. Her ürünü özenle seçtik ve sade bir dille anlattık; aradığınızı kolayca bulursunuz."

/** The fake's answer for a campaign task; null when the data block is no campaign's. */
export function fakeCampaignAnswer(data: string): string | null {
  let fields: Record<string, unknown>
  try {
    const block = JSON.parse(data) as unknown
    fields = isRecord(block) && isRecord(block["data"]) ? block["data"] : {}
  } catch {
    return null
  }
  const name = typeof fields["campaign"] === "string" ? fields["campaign"].slice(0, 40) : null
  if (name === null) {
    return null
  }
  if (typeof fields[CAMPAIGN_SMS_ROOM_FIELD] === "string") {
    return JSON.stringify({
      texts: [`${name} başladı.`, `${name} sizi bekliyor.`, `Yeni seçkimiz: ${name}.`],
    })
  }
  return JSON.stringify({
    subjects: [name, `${name} için yeni seçkimiz`, `Mağazamızdan haber: ${name}`],
    preheader: "Seçkimizi keşfetmeye davet ediyoruz",
    paragraphs: [`${name} hakkında kısa bir haberimiz var.`, FAKE_PARAGRAPH],
  })
}
