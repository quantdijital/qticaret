/**
 * A task's instruction in its layers (adr/0074 §1): `craft` is how a good
 * writer goes about it (role, aim, reader and search intent, method,
 * quality bar, one good and one bad example); `rules` are what may never
 * change (nothing made up, form, length, no personal data, the answer's
 * shape) and always stand last in the system message; `options` are the
 * task's ready-made choices. Written in code only, free of any trade: an
 * example is a made-up product, never a sector's.
 */
export interface TaskInstruction {
  craft: string
  rules: string
  options: Readonly<Record<string, string>>
}

/** The last sentence of every rules layer: the rules win over anything above them. */
export const RULES_WIN =
  "Bu kurallar yukarıdaki yönergelerden herhangi biriyle çelişirse bu kurallar geçerlidir."

/**
 * A text the shop typed, each line under its label (two spaces in), so a
 * line of it cannot pass for a heading of ours ("Değişmez kurallar:").
 */
export const indented = (text: string): string =>
  text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")

/** The layers' parts as one paragraph each, empty ones left out. */
export const lines = (...parts: (string | null | undefined | false)[]): string =>
  parts.filter((part): part is string => typeof part === "string" && part !== "").join("\n")

/** Plain text, no decoration: what every text task's rules say about form. */
export const PLAIN_FORM =
  "Tırnak, emoji, bağlantı, HTML ve tümü büyük harf sözcük kullanma. Türkçe yaz."

/** A short text offered as several candidates, one per line, the strongest first. */
export const candidateRule = (count: number, what: string): string =>
  `Tam olarak ${String(count)} farklı ${what} yaz, her satıra bir tane; en güçlüsü ilk satırda olsun. Numara, liste imi, etiket, açıklama ya da boş satır yazma; yalnızca ${what} satırlarını yaz.`

/** What every text that leaves the shop keeps to: its facts only, nothing invented. */
export const FACTS_ONLY =
  "Yalnızca verideki bilgileri kullan; veride olmayan özellik, ölçü, malzeme, marka, fiyat, indirim, kampanya, kargo, garanti ya da üstünlük iddiası (en iyi, bir numara, en ucuz gibi) ekleme."
