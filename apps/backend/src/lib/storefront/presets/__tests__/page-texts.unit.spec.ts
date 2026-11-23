import { LAYOUT_LIMITS } from "../../layout-fields"
import type { ContentPageSection } from "../../layout-pages"
import type { PageTextSource } from "../../page-text"
import { isShopText, withShopTexts } from "../page-texts"

const ABOUT = "cnt_01KABOUT0000000000000000"
const CONTACT = "cnt_01KCONTACT00000000000000"

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})
const help = (id: string) => ({ id, type: "help", title: "Hangi bıçak size uygun?", text: null })
const pane = (id: string) => ({
  id,
  type: "rich_text",
  title: "Neye inanıyoruz",
  body: doc("Biz."),
})
const article = (id: string, text: string) =>
  ({
    id,
    type: "rich_text",
    variant: "article",
    title: null,
    body: doc(text),
    outline: "auto",
    questions: "auto",
  }) as unknown as ContentPageSection
const contact = (id: string) =>
  ({ id, type: "contact", body: doc("Bize yazın.") }) as unknown as ContentPageSection
const source = (id: string, text: string, roles: PageTextSource["roles"] = []): PageTextSource => ({
  id,
  body: doc(text) as PageTextSource["body"],
  roles,
})

const look = (sections: unknown[]) => ({ page_id: ABOUT, sections })
const ids = (sections: readonly unknown[]) => sections.map((each) => (each as { id: string }).id)

describe("a ready-made look keeps the shop's page text (adr/0073 Ek 2026-11-19 (2) K6)", () => {
  it("counts the page's text as its `article` and `contact`, never the look's other rich texts", () => {
    expect(isShopText(article("metin00001", "Biz."))).toBe(true)
    expect(isShopText(contact("iletisim01"))).toBe(true)
    expect(isShopText(pane("inanc00001"))).toBe(false)
    expect(isShopText({ ...pane("hikaye0001"), variant: "with_image" })).toBe(false)
    expect(isShopText(help("yardim0001"))).toBe(false)
  })

  it("puts the shop's text in the place of the look's, the look's text left out", () => {
    const shop = [{ page_id: ABOUT, sections: [article("bizimmetin", "Atölyemiz Denizli'de.")] }]

    const out = withShopTexts(
      [look([article("lookmetin1", "Köklerimizden."), pane("inanc00001"), help("yardim0001")])],
      shop,
      new Map(),
      []
    )

    expect(out.pages.map((page) => ids(page.sections))).toEqual([
      ["bizimmetin", "inanc00001", "yardim0001"],
    ])
    expect(out.pages[0]?.sections[0]).toMatchObject({ body: doc("Atölyemiz Denizli'de.") })
    expect(out.kept).toEqual([ABOUT])
    expect(ids(out.carried)).toEqual(["bizimmetin"])
    expect(out.dropped).toEqual([])
  })

  it("keeps the look's sections before its first text before the shop's, in the shop's order", () => {
    const shop = [
      {
        page_id: ABOUT,
        sections: [
          article("metinbir01", "Bir."),
          help("eskiyardim"),
          article("metiniki01", "İki."),
        ],
      },
    ]

    const out = withShopTexts(
      [look([help("ustyardim1"), article("lookmetin1", "Köklerimizden."), pane("inanc00001")])],
      shop,
      new Map(),
      []
    )

    // The shop's other sections are the old design: the look's replace them
    expect(ids(out.pages[0]?.sections ?? [])).toEqual([
      "ustyardim1",
      "metinbir01",
      "metiniki01",
      "inanc00001",
    ])
  })

  it("puts the shop's text first where the look lays the page out without a text", () => {
    const shop = [{ page_id: ABOUT, sections: [article("bizimmetin", "Biz.")] }]

    const out = withShopTexts([look([pane("inanc00001"), help("yardim0001")])], shop, new Map(), [])

    expect(ids(out.pages[0]?.sections ?? [])).toEqual(["bizimmetin", "inanc00001", "yardim0001"])
  })

  it("takes the shop's text from the page's mirror when the draft lays it out without one", () => {
    // A design from before the text was a section, or a page past the design's limit (K1)
    const shop = [{ page_id: ABOUT, sections: [help("eskiyardim")] }]
    const sources = new Map([[ABOUT, source(ABOUT, "Atölyemiz Denizli'de.")]])

    const out = withShopTexts([look([article("lookmetin1", "Köklerimizden.")])], shop, sources, [])

    const [text] = out.pages[0]?.sections ?? []
    expect(text).toMatchObject({
      type: "rich_text",
      variant: "article",
      body: doc("Atölyemiz Denizli'de."),
    })
    expect(out.kept).toEqual([ABOUT])
    expect(out.carried).toEqual([text])
  })

  it("keeps the contact page's contact section, made from its mirror for the contact role", () => {
    const sources = new Map([[CONTACT, source(CONTACT, "Bize yazın.", ["contact"])]])

    const out = withShopTexts(
      [
        {
          page_id: CONTACT,
          sections: [article("lookmetin1", "Köklerimizden."), help("yardim0001")],
        },
      ],
      [],
      sources,
      []
    )

    expect(out.pages[0]?.sections.map((each) => (each as { type: string }).type)).toEqual([
      "contact",
      "help",
    ])
  })

  it("gives the look's text to a page with none of the shop's (an empty mirror, a page just opened)", () => {
    const sources = new Map([[ABOUT, source(ABOUT, "")]])
    const page = look([article("lookmetin1", "Köklerimizden."), pane("inanc00001")])

    const out = withShopTexts([page], [], sources, [])

    expect(out.pages).toEqual([page])
    expect(out.kept).toEqual([])
    expect(out.carried).toEqual([])
  })

  it("gives a kept text a new id when another section of the design holds its own", () => {
    const shop = [{ page_id: ABOUT, sections: [article("anayardim1", "Biz.")] }]

    const out = withShopTexts([look([pane("inanc00001")])], shop, new Map(), [
      { home: [help("anayardim1")] },
    ])

    const [text] = out.pages[0]?.sections ?? []
    expect((text as { id: string }).id).not.toBe("anayardim1")
    expect((text as { id: string }).id).toMatch(/^p[0-9a-f]{16}$/)
  })

  it("keeps its ids on applying the look again: the look's own text id is free once replaced", () => {
    const shop = [{ page_id: ABOUT, sections: [article("lookmetin1", "Biz.")] }]

    const out = withShopTexts(
      [look([article("lookmetin1", "Köklerimizden.")])],
      shop,
      new Map(),
      []
    )

    expect(ids(out.pages[0]?.sections ?? [])).toEqual(["lookmetin1"])
    expect(out.pages[0]?.sections[0]).toMatchObject({ body: doc("Biz.") })
  })

  it("leaves out the look's last sections past the page's limit, never the shop's text", () => {
    const shop = [
      { page_id: ABOUT, sections: [article("metinbir01", "Bir."), article("metiniki01", "İki.")] },
    ]
    const many = Array.from({ length: LAYOUT_LIMITS.page }, (_, index) =>
      help(`yardim${String(index).padStart(4, "0")}`)
    )

    const out = withShopTexts([look(many)], shop, new Map(), [])

    expect(out.pages[0]?.sections).toHaveLength(LAYOUT_LIMITS.page)
    expect(ids(out.pages[0]?.sections ?? []).slice(0, 2)).toEqual(["metinbir01", "metiniki01"])
    expect(out.dropped).toEqual([`pages.${ABOUT}.yardim0010`, `pages.${ABOUT}.yardim0011`])
  })
})
