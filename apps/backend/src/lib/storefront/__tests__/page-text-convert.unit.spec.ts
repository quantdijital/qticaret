import { LAYOUT_LIMITS } from "../layout-fields"
import { readStoredLayout } from "../layout"
import { convertPages } from "../page-text-convert"
import type { PageTextSource } from "../page-text"
import { withPageText } from "../page-text-stored"

const ABOUT = "cnt_01KABOUT0000000000000000"
const CONTACT = "cnt_01KCONTACT00000000000000"
const EMPTY = "cnt_01KEMPTY0000000000000000"
const doc = (text?: string) => ({
  type: "doc" as const,
  content: text ? [{ type: "paragraph" as const, content: [{ type: "text" as const, text }] }] : [],
})
const help = (id: string, placement?: string) => ({
  id,
  type: "help",
  visible: true,
  starts_at: null,
  ends_at: null,
  title: null,
  text: null,
  ...(placement ? { placement } : {}),
})
const source = (
  id: string,
  text?: string,
  roles: PageTextSource["roles"] = []
): PageTextSource => ({ id, body: doc(text), roles })
const shape = (stored: Record<string, unknown>) =>
  readStoredLayout(stored).pages.map((page) => [
    page.page_id,
    page.sections.map((section) =>
      section.type === "rich_text" ? `rich_text:${section.variant}` : section.type
    ),
  ])

/** adr/0073 Ek 2026-11-19 (2) K3: the pages' texts moved into the design, once. */
describe("moving the pages' texts into the design", () => {
  it("puts an older entry's text where it stood and gives a page without one its text", () => {
    const stored = {
      home: [],
      pages: [
        {
          page_id: ABOUT,
          sections: [help("alt000001", "bottom"), help("ust000001", "top")],
        },
      ],
    }
    const { document, count } = convertPages(stored, [
      source(ABOUT, "Biz kimiz."),
      source(CONTACT, "Bize yazın.", ["contact"]),
      source(EMPTY),
    ])
    expect(shape(document)).toEqual([
      [ABOUT, ["help", "rich_text:article", "help"]],
      [CONTACT, ["contact"]],
    ])
    expect(count).toEqual({ converted: 2, left: 0, dropped: 0, failed: 0 })
    // The whole design is held to the editor's schema, no older place left
    expect(JSON.stringify(document)).not.toContain("placement")
  })

  it("gives the same design on a second run", () => {
    const stored = { pages: [{ page_id: ABOUT, sections: [help("ust000001", "top")] }] }
    const sources = [source(ABOUT, "Biz."), source(CONTACT, "Yazın.", ["contact"])]
    const once = convertPages(stored, sources).document
    const twice = convertPages(once, sources)
    expect(twice.document).toBe(once)
    expect(twice.count).toEqual({ converted: 0, left: 0, dropped: 0, failed: 0 })
  })

  it("passes over an entry holding text or laid out as one list", () => {
    const stored = {
      pages: [
        { page_id: ABOUT, sections: [help("yardim001")] },
        {
          page_id: CONTACT,
          sections: [{ id: "iletisim01", type: "contact", body: doc("Eski.") }],
        },
      ],
    }
    const { document } = convertPages(stored, [
      source(ABOUT, "Yeni."),
      source(CONTACT, "Yeni.", ["contact"]),
    ])
    expect(document).toBe(stored)
  })

  it("leaves the pages past the design's room without an entry, drawn from their text", () => {
    const full = Array.from({ length: LAYOUT_LIMITS.pages }, (_, n) => ({
      page_id: `cnt_01KFULL${String(n).padStart(3, "0")}`,
      sections: [help(`dolu${String(n).padStart(4, "0")}`)],
    }))
    const { document, count } = convertPages({ pages: full }, [
      source(ABOUT, "Biz."),
      source(CONTACT, "Yazın.", ["contact"]),
    ])
    expect(document).toEqual({ pages: full })
    expect(count).toEqual({ converted: 0, left: 2, dropped: 0, failed: 0 })
  })

  it("passes over a page whose conversion throws, the others still moving", () => {
    const broken = { id: EMPTY, body: doc("Bozuk."), roles: null } as unknown as PageTextSource
    const { document, count } = convertPages({ pages: [] }, [broken, source(ABOUT, "Biz.")])
    expect(shape(document)).toEqual([[ABOUT, ["rich_text:article"]]])
    expect(count).toEqual({ converted: 1, left: 0, dropped: 0, failed: 1 })
  })

  it("drops the last sections past a page's twelve, counted", () => {
    const sections = Array.from({ length: LAYOUT_LIMITS.page }, (_, n) =>
      help(`alt${String(n).padStart(6, "0")}`, "bottom")
    )
    const { document, count } = convertPages({ pages: [{ page_id: ABOUT, sections }] }, [
      source(ABOUT, "Biz."),
    ])
    const [page] = readStoredLayout(document).pages
    expect(page?.sections).toHaveLength(LAYOUT_LIMITS.page)
    expect(page?.sections[0]).toMatchObject({ type: "rich_text", variant: "article" })
    expect(count).toEqual({ converted: 1, left: 0, dropped: 1, failed: 0 })
  })
})

/** K4: a page's text replaced by the system (an import, the shop profile). */
describe("a page's text replaced in the design", () => {
  it("replaces the first page text, keeping every other section", () => {
    const stored = {
      pages: [
        {
          page_id: ABOUT,
          sections: [
            help("ust000001"),
            { id: "metin0001", type: "rich_text", variant: "article", body: doc("Eski.") },
          ],
        },
      ],
    }
    const next = withPageText(stored, source(ABOUT, "Yeni."))
    expect(next && readStoredLayout(next).pages[0]?.sections[1]).toMatchObject({
      id: "metin0001",
      body: doc("Yeni."),
    })
  })

  it("puts a new text at an older entry's place, and makes an entry where there is none", () => {
    const older = { pages: [{ page_id: ABOUT, sections: [help("ust000001", "top")] }] }
    expect(shape(withPageText(older, source(ABOUT, "Yeni.")) ?? {})).toEqual([
      [ABOUT, ["help", "rich_text:article"]],
    ])
    expect(shape(withPageText({}, source(CONTACT, "Yazın.", ["contact"])) ?? {})).toEqual([
      [CONTACT, ["contact"]],
    ])
    // No text and no role: no entry to make
    expect(withPageText({}, source(EMPTY))).toBeNull()
  })
})
