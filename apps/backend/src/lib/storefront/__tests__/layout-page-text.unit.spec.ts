import path from "node:path"
import { layoutDocument, readStoredLayout, readStoredLayoutTexts } from "../layout"
import { legacyTextAt } from "../layout-pages-stored"
import { CONTACT_SWITCHES, PAGE_ONLY_TYPES } from "../sections/page-text"
import { PAGE_TEXT_SWITCHES } from "../sections/rich-text"
import { logger } from "../../logging"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT = path.resolve(__dirname, "../../../../../../packages/types/src/store")

const PAGE = "cnt_01KABOUT0000000000000000"
const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})
const page = (sections: unknown[]) => ({ pages: [{ page_id: PAGE, sections }] })
const issues = (value: Record<string, unknown>) =>
  layoutDocument.safeParse(value).error?.issues.map((issue) => issue.message) ?? []
const article = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  type: "rich_text",
  variant: "article",
  body: doc("Biz kimiz."),
  ...more,
})

describe("a content page's own text sections (adr/0073 Ek 2026-11-19 (2) K2)", () => {
  it("keeps the contract's lists equal to the backend's", () => {
    const pages = jest.requireActual<Record<string, unknown>>(`${CONTRACT}/section-pages.ts`)
    const richText = jest.requireActual<Record<string, unknown>>(`${CONTRACT}/section-rich-text.ts`)
    expect(PAGE_ONLY_TYPES).toEqual(pages["PAGE_ONLY_TYPES"])
    expect(CONTACT_SWITCHES).toEqual(pages["CONTACT_SWITCHES"])
    expect(PAGE_TEXT_SWITCHES).toEqual(richText["PAGE_TEXT_SWITCHES"])
  })

  it("reads the page text with today's drawing switched on, the contact section with its parts", () => {
    const read = layoutDocument.parse(
      page([
        article("metin0001"),
        { id: "iletisim01", type: "contact", body: doc("Yazın.") },
        { id: "odeme00001", type: "payment_facts" },
        { id: "kargo00001", type: "shipping_facts" },
      ])
    )
    expect(read.pages[0]?.sections).toEqual([
      {
        ...article("metin0001"),
        ...ALWAYS,
        title: null,
        outline: "auto",
        questions: "auto",
      },
      {
        id: "iletisim01",
        type: "contact",
        ...ALWAYS,
        body: doc("Yazın."),
        form: "on",
        imprint: "on",
      },
      { id: "odeme00001", type: "payment_facts", ...ALWAYS },
      { id: "kargo00001", type: "shipping_facts", ...ALWAYS },
    ])
  })

  it("holds the switches to their lists and the sections to their fields", () => {
    expect(issues(page([article("metin0001", { outline: "yes" })]))).not.toEqual([])
    expect(issues(page([article("metin0001", { questions: "on" })]))).not.toEqual([])
    expect(
      issues(page([{ id: "iletisim01", type: "contact", body: doc("x"), form: "maybe" }]))
    ).not.toEqual([])
    expect(issues(page([{ id: "odeme00001", type: "payment_facts", title: "Ödeme" }]))).not.toEqual(
      []
    )
    // The page text's document is held to the content schema: no HTML
    expect(issues(page([article("metin0001", { body: "<p>Biz</p>" })]))).not.toEqual([])
  })

  it("takes each of the page's own types once on a page, the page text as often as wanted", () => {
    const twice = (type: string) => [
      { id: `${type.slice(0, 5)}0001`, type, ...(type === "contact" ? { body: doc("x") } : {}) },
      { id: `${type.slice(0, 5)}0002`, type, ...(type === "contact" ? { body: doc("x") } : {}) },
    ]
    for (const type of PAGE_ONLY_TYPES) {
      expect(issues(page(twice(type)))).toContain("storefront_layout.section_duplicate")
    }
    expect(issues(page([article("metin0001"), article("metin0002")]))).toEqual([])
  })

  it("keeps the page's own sections and its text off every other group", () => {
    expect(issues({ home: [article("metin0001")] })).not.toEqual([])
    expect(issues({ product: [article("metin0001")] })).not.toEqual([])
    expect(issues({ footer: [article("metin0001")] })).not.toEqual([])
    expect(issues({ home: [{ id: "iletisim01", type: "contact", body: doc("x") }] })).toContain(
      "storefront_layout.section_invalid"
    )
    expect(issues({ home: [{ id: "odeme00001", type: "payment_facts" }] })).toContain(
      "storefront_layout.section_invalid"
    )
  })
})

describe("a page stored before its text was a section (K1)", () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    warn.mockRestore()
  })

  const help = (id: string, placement?: string) => ({
    id,
    type: "help",
    ...(placement ? { placement } : {}),
  })

  it("reads as one list, the sections above its text first, and says where the text stood", () => {
    const stored = page([
      help("alt000001", "bottom"),
      help("ust000001", "top"),
      help("alt000002", "bottom"),
      help("ust000002", "top"),
    ])
    const { document, text_at } = readStoredLayoutTexts(stored)
    expect(document.pages[0]?.sections.map((section) => section.id)).toEqual([
      "ust000001",
      "ust000002",
      "alt000001",
      "alt000002",
    ])
    expect(document.pages[0]?.sections.some((section) => "placement" in section)).toBe(false)
    expect(text_at).toEqual({ [PAGE]: 2 })
    expect(legacyTextAt(stored)).toEqual({ [PAGE]: 2 })
  })

  it("counts only the sections above the text that still read", () => {
    const stored = page([
      { id: "gelecek01", type: "future_section", placement: "top" },
      help("ust000001", "top"),
      help("alt000001", "bottom"),
    ])
    expect(readStoredLayoutTexts(stored).text_at).toEqual({ [PAGE]: 1 })
  })

  it("gives no place for a page whose sections are one list, nor for a design without pages", () => {
    expect(legacyTextAt(page([help("yardim001"), article("metin0001")]))).toEqual({})
    expect(legacyTextAt({})).toEqual({})
    expect(legacyTextAt(null)).toEqual({})
    expect(readStoredLayout(page([help("yardim001")])).pages[0]?.sections).toHaveLength(1)
  })
})
