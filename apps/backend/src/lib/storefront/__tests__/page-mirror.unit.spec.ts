import { contentPageSection } from "../layout-pages"
import type { ContentPageSection, PageLayout } from "../layout-pages"
import { pageMirror, pageSectionId, pageTextSections, withTextAt } from "../page-text"
import { mirrorsOf } from "../../../workflows/storefront/page-mirror"

const PAGE = "cnt_01KABOUT0000000000000000"
const OTHER = "cnt_01KCONTACT00000000000000"
const doc = (...texts: string[]) => ({
  type: "doc" as const,
  content: texts.map((text) => ({
    type: "paragraph" as const,
    content: [{ type: "text" as const, text }],
  })),
})
const section = (raw: Record<string, unknown>): ContentPageSection => contentPageSection.parse(raw)
const article = (id: string, body = doc("Biz kimiz."), more: Record<string, unknown> = {}) =>
  section({ id, type: "rich_text", variant: "article", body, ...more })
const help = (id: string) => section({ id, type: "help" })

describe("a page's mirror (adr/0073 Ek 2026-11-19 (2) K2)", () => {
  it("is one untitled section's text as it is: a converted page's text does not change", () => {
    const body = doc("Biz kimiz.", "Nereden geliyoruz.")
    expect(pageMirror([help("yardim001"), article("metin0001", body)])).toEqual(body)
    const contact = section({ id: "iletisim01", type: "contact", body })
    expect(pageMirror([contact, section({ id: "odeme00001", type: "payment_facts" })])).toEqual(
      body
    )
  })

  it("joins the shown text sections in order, a titled one's title first as an h2", () => {
    const mirror = pageMirror([
      article("metin0001", doc("Giriş.")),
      help("yardim001"),
      section({ id: "hikaye001", type: "rich_text", title: "Hikâyemiz", body: doc("Atölye.") }),
      article("gizli0001", doc("Taslak."), { visible: false }),
    ])
    expect(mirror).toEqual({
      type: "doc",
      content: [
        ...doc("Giriş.").content,
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hikâyemiz" }] },
        ...doc("Atölye.").content,
      ],
    })
  })

  it("is the empty document when the page shows no text", () => {
    expect(pageMirror([help("yardim001")])).toEqual({ type: "doc", content: [] })
    expect(pageMirror([article("gizli0001", doc("x"), { visible: false })])).toEqual({
      type: "doc",
      content: [],
    })
  })

  it("leaves out text on a schedule, before it starts and after it ends alike", () => {
    const always = article("metin0001", doc("Her zaman."))
    const later = article("sonra0001", doc("Kampanya."), { starts_at: "2099-01-01T00:00:00.000Z" })
    const over = article("bitti0001", doc("Eski duyuru."), { ends_at: "2000-01-01T00:00:00.000Z" })
    // Not yet shown, or shown no more: never in the page's description, dates or advisor
    expect(pageMirror([always, later])).toEqual(doc("Her zaman."))
    expect(pageMirror([over, always])).toEqual(doc("Her zaman."))
    expect(pageMirror([later, over])).toEqual({ type: "doc", content: [] })
    // Shown now but scheduled to end: left out too, the mirror does not follow the clock
    const ending = article("bitecek01", doc("Bu hafta."), { ends_at: "2099-01-01T00:00:00.000Z" })
    expect(pageMirror([ending])).toEqual({ type: "doc", content: [] })
  })

  it("is written for pages holding text, and for a page whose text was taken off", () => {
    const pages: PageLayout[] = [
      { page_id: PAGE, sections: [article("metin0001")] },
      { page_id: OTHER, sections: [help("yardim001")] },
    ]
    // A page laid out before its text was a section holds no text: its text is left alone
    expect([...mirrorsOf(pages, new Set()).keys()]).toEqual([PAGE])
    // It held text in the live design before: its mirror is empty now
    const mirrors = mirrorsOf(pages, new Set([OTHER]))
    expect([...mirrors.keys()]).toEqual([PAGE, OTHER])
    expect(mirrors.get(OTHER)).toEqual({ type: "doc", content: [] })
    // A page with no entry keeps its text, drawn from it
    expect(mirrorsOf([], new Set([PAGE])).size).toBe(0)
  })
})

describe("a page's text made into sections (K1, K3)", () => {
  it("makes a plain page's text an article, its ids the page's on every run", () => {
    const made = pageTextSections({ id: PAGE, body: doc("Biz."), roles: [] }, new Set())
    expect(made).toEqual([
      expect.objectContaining({ type: "rich_text", variant: "article", body: doc("Biz.") }),
    ])
    const again = pageTextSections({ id: PAGE, body: doc("Biz."), roles: [] }, new Set())
    expect(again[0]?.id).toBe(made[0]?.id)
    expect(made[0]?.id).toMatch(/^[a-z0-9]{6,24}$/)
  })

  it("follows the page's roles: the contact section, the facts after the text", () => {
    const types = (roles: ("contact" | "payment" | "shipping")[], body = doc("Metin.")) =>
      pageTextSections({ id: PAGE, body, roles }, new Set()).map((each) =>
        each.type === "rich_text" ? `rich_text:${each.variant}` : each.type
      )
    expect(types(["contact"])).toEqual(["contact"])
    expect(types(["contact"], doc())).toEqual(["contact"])
    expect(types(["payment"])).toEqual(["rich_text:article", "payment_facts"])
    expect(types(["shipping"])).toEqual(["rich_text:article", "shipping_facts"])
    expect(types(["shipping"], doc())).toEqual(["shipping_facts"])
    expect(types([], doc())).toEqual([])
  })

  it("takes an id another section holds anew, and marks it taken", () => {
    const first = pageSectionId(PAGE, "article", new Set())
    const taken = new Set([first])
    const next = pageSectionId(PAGE, "article", taken)
    expect(next).not.toBe(first)
    const made = pageTextSections({ id: PAGE, body: doc("x"), roles: [] }, taken)
    expect(made[0]?.id).toBe(next)
    expect(taken.has(next)).toBe(true)
  })

  it("puts the text where an older page's text stood, twelve sections kept", () => {
    const around = [help("ust000001"), help("alt000001"), help("alt000002")]
    const text = [article("metin0001")]
    expect(withTextAt(around, text, 1, 12).sections.map((each) => each.id)).toEqual([
      "ust000001",
      "metin0001",
      "alt000001",
      "alt000002",
    ])
    const full = Array.from({ length: 12 }, (_, n) => help(`alt${String(n).padStart(6, "0")}`))
    const placed = withTextAt(full, text, 0, 12)
    expect(placed.sections[0]?.id).toBe("metin0001")
    expect(placed.sections).toHaveLength(12)
    expect(placed.dropped).toBe(1)
  })
})
