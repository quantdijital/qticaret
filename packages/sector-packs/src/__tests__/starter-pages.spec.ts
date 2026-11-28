import { sectorPacks } from "../index"
import { STARTER_HANDLES } from "./starters"

/** The page's own types a starter page holds beside its text (adr/0073 Ek 2026-11-28). */
const OWN_TYPES: Record<string, string[]> = {
  iletisim: ["contact"],
  "sik-sorulan-sorular": ["faq"],
  "odeme-secenekleri": ["rich_text", "payment_facts"],
  "kargo-ve-teslimat": ["rich_text", "shipping_facts"],
}

const TOKEN = /\{([\p{L}\p{N}_]+)\}/gu
// The shop details a page's text may stand in for (backend `lib/shop/tokens.ts`)
const SHOP_TOKENS = new Set([
  "mağaza_adı",
  "telefon",
  "e_posta",
  "adres",
  "whatsapp",
  "ücretsiz_kargo_eşiği",
  "hazırlama_süresi",
  "kargo_süresi",
  "iade_süresi",
])

describe("the starter pages (adr/0073 Ek 2026-11-28)", () => {
  it("are laid out by every look, Hakkımızda first", () => {
    const presets = sectorPacks().flatMap((pack) => pack.presets)
    expect(presets.length).toBeGreaterThanOrEqual(7)
    for (const preset of presets) {
      const refs = (preset.layout.pages ?? []).map((page) => page.page_id.$handle)
      expect([preset.code, refs]).toEqual([
        preset.code,
        STARTER_HANDLES.map((handle) => `page:${handle}`),
      ])
    }
  })

  it("hold the role pages' own sections: the contact form, the questions, the live facts", () => {
    for (const preset of sectorPacks().flatMap((pack) => pack.presets)) {
      for (const page of preset.layout.pages ?? []) {
        const handle = page.page_id.$handle.slice("page:".length)
        const want = OWN_TYPES[handle]
        if (want) {
          expect([preset.code, handle, page.sections.map((each) => each.type)]).toEqual([
            preset.code,
            handle,
            want,
          ])
        }
      }
    }
  })

  it("are offered by every pack, with the same texts", () => {
    const general = sectorPacks().find((pack) => pack.code === "general")
    for (const pack of sectorPacks()) {
      const starters = (pack.pages ?? []).filter((page) => STARTER_HANDLES.includes(page.handle))
      expect([pack.code, starters.map((page) => page.handle)]).toEqual([pack.code, STARTER_HANDLES])
      expect(starters).toEqual(general?.pages)
    }
  })

  it("name only the shop's details, and no sample or test words", () => {
    const texts = JSON.stringify([
      sectorPacks().map((pack) => pack.pages),
      sectorPacks().flatMap((pack) =>
        pack.presets.map((preset) =>
          (preset.layout.pages ?? []).filter(
            (page) => page.page_id.$handle !== "page:hakkimizda" || preset.code !== "katalog"
          )
        )
      ),
    ])
    const tokens = new Set([...texts.matchAll(TOKEN)].map(([, name = ""]) => name))
    expect([...tokens].filter((name) => !SHOP_TOKENS.has(name))).toEqual([])
    expect(texts).not.toMatch(/\b(demo|deneme|test|lorem|örnek)\b/i)
  })
})
