import { sectorPacks } from "../index"
import { STARTER_HANDLES } from "./starters"

// A pack that sells no goods to ship (tours) offers no shipping page (owner, 2026-11-28)
const NO_SHIPPING = new Set(["travel"])
const startersOf = (pack: string): string[] =>
  NO_SHIPPING.has(pack)
    ? STARTER_HANDLES.filter((handle) => handle !== "kargo-ve-teslimat")
    : STARTER_HANDLES

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
  it("are laid out by every look, Hakkımızda first; a tour's look has no shipping page", () => {
    const presets = sectorPacks().flatMap((pack) => pack.presets)
    expect(presets.length).toBeGreaterThanOrEqual(7)
    for (const preset of presets) {
      const refs = (preset.layout.pages ?? []).map((page) => page.page_id.$handle)
      expect([preset.code, refs]).toEqual([
        preset.code,
        startersOf(preset.pack).map((handle) => `page:${handle}`),
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

  it("are offered by every pack, with the same texts but a tour's own questions", () => {
    const general = sectorPacks().find((pack) => pack.code === "general")
    for (const pack of sectorPacks()) {
      const wanted = startersOf(pack.code)
      const starters = (pack.pages ?? []).filter((page) => STARTER_HANDLES.includes(page.handle))
      expect([pack.code, starters.map((page) => page.handle)]).toEqual([pack.code, wanted])
      const same = (page: { handle: string }) =>
        wanted.includes(page.handle) &&
        !(NO_SHIPPING.has(pack.code) && page.handle === "sik-sorulan-sorular")
      expect(starters.filter(same)).toEqual(general?.pages?.filter(same))
    }
  })

  it("ask a tour shop no shipping questions", () => {
    const travel = sectorPacks().find((pack) => pack.code === "travel")
    const faq = JSON.stringify([
      travel?.pages?.find((page) => page.handle === "sik-sorulan-sorular"),
      travel?.presets.map((preset) =>
        preset.layout.pages?.find((page) => page.page_id.$handle === "page:sik-sorulan-sorular")
      ),
    ]).toLocaleLowerCase("tr")
    expect(faq).toContain("rezervasyon")
    expect(faq).not.toMatch(/kargo|teslimat/)
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
