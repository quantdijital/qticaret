import type { PanelMapEntry } from "@qticaret/types/panel-map"
import { describe, expect, it } from "vitest"
import tr from "@/locales/tr.json"
import { PANEL_MAP } from "./map"
import { firstSentence, foldText, searchPanelMap, wordsOf } from "./search"

const entry = (
  key: string,
  label: string,
  keywords: string[],
  more: Partial<PanelMapEntry> = {}
): PanelMapEntry => ({
  key,
  path: `/${key}`,
  label,
  keywords: { tr: keywords, en: [] },
  help: { tr: `${label} burada.`, en: `${label} here.` },
  ...more,
})

// Labels are their own text here: `text` hands the key back
const search = (
  query: string,
  screens: readonly PanelMapEntry[],
  allowed: (screen: PanelMapEntry) => boolean = () => true
) =>
  searchPanelMap(query, screens, { text: (key) => key, language: "tr", allowed }).map(
    (hit) => hit.screen.key
  )

describe("foldText: Turkish letters and case folded", () => {
  it.each([
    ["İADE", "iade"],
    ["Iğdır", "igdir"],
    ["ışık", "isik"],
    ["Şartlar", "sartlar"],
    ["ÜCRET", "ucret"],
    ["Öneri", "oneri"],
    ["Çerez", "cerez"],
    ["Yapay zekâ", "yapay zeka"],
  ])("%s → %s", (text, folded) => {
    expect(foldText(text)).toBe(folded)
  })

  it("splits words, a hyphenated one counted whole too", () => {
    expect(wordsOf("E-posta şablonu")).toEqual(["e", "posta", "eposta", "sablonu"])
  })
})

describe("searchPanelMap", () => {
  const screens = [
    entry("shipping", "Kargo ve teslimat", ["kargo ayarları"]),
    entry("rates", "Seçenekler ve ücretler", ["kargo ücreti", "gönderim bedeli"], {
      parent: "shipping",
    }),
    entry("orders", "Siparişler", ["satış"]),
  ]

  it("matches typed words by their beginnings, whatever the letters' case and accents", () => {
    expect(search("KARGO UCRETI", screens)).toEqual(["rates"])
    expect(search("gonderim bed", screens)).toEqual(["rates"])
    expect(search("sipar", screens)).toEqual(["orders"])
  })

  it("needs every typed word to be found somewhere", () => {
    expect(search("kargo sipariş", screens)).toEqual([])
    expect(search("argo", screens)).toEqual([])
    expect(search("   ", screens)).toEqual([])
  })

  it("puts a name before a keyword and a keyword before the help", () => {
    const ranked = [
      entry("helped", "Birinci", ["başka"], { help: { tr: "Fatura burada.", en: "" } }),
      entry("keyword", "İkinci", ["fatura kes"]),
      entry("named", "Fatura ayarları", ["başka"]),
    ]
    expect(search("fatura", ranked)).toEqual(["named", "keyword", "helped"])
  })

  it("finds a screen by the trail it sits under, below one named so", () => {
    expect(search("kargo", screens)).toEqual(["shipping", "rates"])
  })

  it("offers only what the staff member may open, nor what sits under a closed one", () => {
    const gated = [
      entry("shipping", "Kargo", ["kargo"], { needs: "settings" }),
      entry("rates", "Kargo ücretleri", ["kargo"], { parent: "shipping" }),
      entry("orders", "Kargo takibi", ["kargo"]),
    ]
    expect(search("kargo", gated, (screen) => screen.needs !== "settings")).toEqual(["orders"])
  })

  it("keeps the map's order on a tie and stops at eight", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      entry(`k${index}`, `Ayar ${index}`, ["x"])
    )
    expect(search("ayar", many)).toEqual(["k0", "k1", "k2", "k3", "k4", "k5", "k6", "k7"])
  })
})

describe("the real map's everyday words", () => {
  const text = (key: string) =>
    String(
      key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], tr)
    )
  const first = (query: string) =>
    searchPanelMap(query, PANEL_MAP, { text, language: "tr", allowed: () => true })[0]?.screen.key

  it.each([
    ["kargo ücreti", "settings.shipping.options"],
    ["gönderim bedeli", "settings.shipping.options"],
    ["shipping rate", "settings.shipping.options"],
    ["havale", "settings.payments.other"],
    ["iban", "settings.payments.other"],
    ["fatura sağlayıcısı", "settings.einvoice.program"],
    ["alan adı", "settings.seo.addresses"],
    ["kvkk", "settings.legal"],
    ["kdv", "settings.einvoice.vat"],
    ["ödeme sağlayıcısı", "settings.payments.card"],
    ["e-posta şablonu", "settings.notifications.templates"],
    ["kullanıcı ekle", "settings.security.team"],
    ["tema", "themeEditor"],
    ["indirim kodu", "promotions"],
    ["iade süresi", "settings.shipping.returns"],
    ["kalkış", "products.dated"],
    ["yapay zeka", "settings.ai"],
    ["sifre degistir", "settings.security.account"],
  ])("%s → %s", (query, key) => {
    expect(first(query)).toBe(key)
  })
})

describe("firstSentence", () => {
  it("keeps the first sentence of a help", () => {
    expect(firstSentence("Birinci cümle. İkinci cümle.")).toBe("Birinci cümle.")
    expect(firstSentence("Tek cümle")).toBe("Tek cümle")
  })
})
