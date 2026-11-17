import { layoutDocument } from "../layout"
import { FOOTER_BAR_DEFAULTS } from "../sections/footer-bar"
import { FOOTER_BLOCK_MAX, FOOTER_ROWS_LIMITS } from "../sections/footer-blocks"
import { FOOTER_ROWS_DEFAULTS, footerStartRows } from "../sections/footer-rows"

const L = FOOTER_ROWS_LIMITS
const key = (name: string) => `storefront_layout.${name}`

let serial = 0
/** A fresh id in the sections' form. */
const id = () => `blk${String((serial += 1)).padStart(5, "0")}`

type Fields = Record<string, unknown>
const block = (type: string, more: Fields = {}) => ({ id: id(), type, ...more })
const menu = (slot = 1) => block("menu", { slot })
const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] })
const body = (...content: unknown[]) => ({ type: "doc", content })
const words = (more: Fields = {}) => block("text", { body: body(paragraph("Kargo")), ...more })
const picture = (more: Fields = {}) =>
  block("image", { image: { url: "/media/rozet.png", alt: "Rozet" }, ...more })

/** A row whose split takes as many columns as it is given. */
const row = (columns: unknown[][], more: Fields = {}) => ({
  id: id(),
  layout: Array.from({ length: columns.length }, () => "1").join("-"),
  columns: columns.map((blocks) => ({ blocks })),
  ...more,
})
const footer = (more: Fields = {}) => ({
  id: "mainfooter",
  type: "footer_bar",
  variant: "free_rows",
  ...more,
})
const doc = (rows: unknown, more: Fields = {}) => ({ footer: [footer({ rows })], ...more })
const issues = (document: unknown) =>
  layoutDocument.safeParse(document).error?.issues.map((issue) => issue.message) ?? []
/** The messages of a footer holding this one block. */
const blockIssues = (one: unknown) => issues(doc([row([[one]])]))

describe("the free rows footer's schema (adr/0070 §2)", () => {
  it("reads a footer switched to it with the starting row, every default filled", () => {
    const [bar] = layoutDocument.parse({ footer: [footer()] }).footer
    expect(bar).toEqual({
      ...footer(),
      visible: true,
      starts_at: null,
      ends_at: null,
      ...FOOTER_BAR_DEFAULTS,
      ...FOOTER_ROWS_DEFAULTS,
      rows: footerStartRows(),
    })
    expect(footerStartRows()[0]?.columns.map((column) => column.blocks[0]?.type)).toEqual([
      "brand",
      "menu",
      "menu",
      "contact",
    ])
  })

  it("fills a row's and each block's defaults", () => {
    const parsed = layoutDocument.parse(
      doc([
        {
          id: "rowone01",
          columns: [
            { blocks: [{ id: "blockaa1", type: "newsletter" }] },
            { blocks: [{ id: "blockaa2", type: "trust" }] },
            { blocks: [{ id: "blockaa3", type: "payments" }, picture({ id: "blockaa4" })] },
          ],
        },
      ])
    )
    const [bar] = parsed.footer
    expect(bar).toMatchObject({
      rows: [
        {
          id: "rowone01",
          layout: "1-1-1",
          ground: "inherit",
          space: "medium",
          align: "start",
          phone_columns: 1,
          divider: false,
          columns: [
            {
              blocks: [
                {
                  id: "blockaa1",
                  type: "newsletter",
                  visible: true,
                  device: "all",
                  title: null,
                  text: null,
                  description: null,
                  variant: "standard",
                },
              ],
            },
            { blocks: [{ type: "trust", limit: 3, layout: "list" }] },
            {
              blocks: [
                { type: "payments", title: null, carriers: false },
                { type: "image", width: "medium", link: null },
              ],
            },
          ],
        },
      ],
    })
  })

  it("holds the rows to one to six", () => {
    expect(issues(doc([]))).toEqual([key("footer_rows_limit")])
    const seven = Array.from({ length: L.rows + 1 }, () => row([[]]))
    expect(issues(doc(seven))).toEqual([key("footer_rows_limit")])
    expect(issues(doc(seven.slice(0, L.rows)))).toEqual([])
  })

  it("asks a row's columns to match its split", () => {
    const mismatch = [key("footer_columns_mismatch")]
    expect(issues(doc([row([[], []], { layout: "1-1-1" })]))).toEqual(mismatch)
    expect(issues(doc([row([[], [], []], { layout: "2-1" })]))).toEqual(mismatch)
    expect(issues(doc([{ id: "rowfive1", layout: "1", columns: [{}, {}, {}, {}, {}] }]))).toContain(
      key("footer_columns_mismatch")
    )
    expect(issues(doc([row([[], [], [], []], { layout: "2-1-1-1" })]))).toEqual([])
    expect(issues(doc([row([[]], { layout: "3-1" })]))).toContain(key("section_invalid"))
  })

  it("holds a column to six blocks, the footer to twenty-four and each type to its own count", () => {
    const limit = [key("footer_blocks_limit")]
    const menus = (count: number) => Array.from({ length: count }, (_, at) => menu(at + 1))
    expect(issues(doc([row([menus(L.perColumn + 1)])]))).toEqual(limit)
    expect(issues(doc([row([menus(L.perColumn)])]))).toEqual([])
    // 25 blocks, each type within its own count: 10 menus, 8 texts, 6 pictures, a brand
    const many = [
      ...menus(FOOTER_BLOCK_MAX.menu),
      ...Array.from({ length: FOOTER_BLOCK_MAX.text }, () => words()),
      ...Array.from({ length: FOOTER_BLOCK_MAX.image }, () => picture()),
      block("brand"),
    ]
    const spread = (blocks: unknown[]) =>
      Array.from({ length: 5 }, (_, at) => row([blocks.slice(at * 5, at * 5 + 5)]))
    expect(many).toHaveLength(L.blocks + 1)
    expect(issues(doc(spread(many)))).toEqual(limit)
    expect(issues(doc(spread(many.slice(0, L.blocks))))).toEqual([])
    for (const type of ["brand", "newsletter", "contact", "payments", "trust"]) {
      expect(issues(doc([row([[block(type)], [block(type)]])]))).toEqual(limit)
    }
    const socials = Array.from({ length: FOOTER_BLOCK_MAX.social + 1 }, () => block("social"))
    expect(issues(doc([row([socials])]))).toEqual(limit)
  })

  it("refuses a block off the list, a slot out of range and a field that is not the block's", () => {
    const invalid = [key("footer_block_invalid")]
    expect(blockIssues(block("html", { html: "<b>x</b>" }))).toEqual(invalid)
    expect(blockIssues(menu(0))).toEqual(invalid)
    expect(blockIssues(menu(L.slots + 1))).toEqual(invalid)
    expect(blockIssues(menu(1.5))).toEqual(invalid)
    expect(blockIssues(block("menu"))).toEqual(invalid)
    expect(blockIssues(block("trust", { limit: 5 }))).toEqual(invalid)
    expect(blockIssues(block("newsletter", { variant: "split" }))).toEqual(invalid)
    expect(
      blockIssues(block("image", { image: { url: "/media/a.png", alt: "A" }, width: "huge" }))
    ).toEqual(invalid)
    expect(blockIssues(menu(1))).toEqual([])
    expect(blockIssues(block("brand", { slot: 1 }))).toHaveLength(1)
    expect(blockIssues(block("brand", { html: "<script>" }))).toHaveLength(1)
    expect(blockIssues(block("social", { title: "a".repeat(L.title + 1) }))).toHaveLength(1)
    expect(blockIssues(block("brand", { about: "a".repeat(L.about + 1) }))).toHaveLength(1)
    expect(blockIssues(block("social", { title: "Bizi\u0000izleyin" }))).toEqual([
      key("text_invalid"),
    ])
    expect(blockIssues(block("newsletter", { text: "{bilinmeyen} ile" }))).toEqual([
      key("token_unknown"),
    ])
    expect(blockIssues({ ...menu(1), id: "KISA" })).toEqual([key("section_invalid")])
    expect(blockIssues({ ...menu(1), device: "tablet" })).toEqual([key("section_invalid")])
  })

  it("takes a text block's document only as a footer column's: no heading, card, picture or table", () => {
    const invalid = [key("footer_block_invalid")]
    const heading = { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "x" }] }
    const list = (items: unknown[]) => ({
      type: "bulletList",
      content: items.map((item) => ({ type: "listItem", content: [item] })),
    })
    const linked = {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "İade",
          marks: [{ type: "bold" }, { type: "link", attrs: { href: "/iade" } }],
        },
        { type: "hardBreak" },
        { type: "text", text: "koşulları", marks: [{ type: "italic" }] },
      ],
    }
    expect(
      blockIssues(words({ body: body(linked, list([paragraph("Bir"), paragraph("İki")])) }))
    ).toEqual([])
    expect(blockIssues(words({ body: body(heading) }))).toEqual(invalid)
    expect(
      blockIssues(
        words({ body: body({ type: "productCard", attrs: { id: `prod_${"A".repeat(26)}` } }) })
      )
    ).toEqual(invalid)
    expect(
      blockIssues(
        words({ body: body({ type: "image", attrs: { src: "https://ornek.test/a.png" } }) })
      )
    ).toEqual(invalid)
    expect(
      blockIssues(words({ body: body({ type: "blockquote", content: [paragraph("x")] }) }))
    ).toEqual(invalid)
    // A list in a list is past the depth; raw HTML is no document at all
    expect(blockIssues(words({ body: body(list([list([paragraph("x")])])) }))).toEqual(invalid)
    expect(blockIssues(words({ body: "<p>x</p>" }))).toEqual(invalid)
    expect(blockIssues(words({ body: body(paragraph("a".repeat(L.textChars + 1))) }))).toEqual(
      invalid
    )
    expect(blockIssues(words({ body: body(paragraph("a".repeat(L.textChars))) }))).toEqual([])
    const long = Array.from({ length: L.textNodes / 2 }, () => paragraph("a"))
    expect(blockIssues(words({ body: body(...long) }))).toEqual(invalid)
    const script = {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "x",
          marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
        },
      ],
    }
    expect(blockIssues(words({ body: body(script) }))).toEqual(invalid)
  })

  it("takes an app badge only over https on the store's own host", () => {
    const invalid = [key("footer_block_invalid")]
    const app = (fields: Fields) => blockIssues(block("app_badges", fields))
    const apple = "https://apps.apple.com/tr/app/ornek/id000000000"
    const google = "https://play.google.com/store/apps/details?id=com.ornek"
    expect(app({ app_store: apple })).toEqual([])
    expect(app({ google_play: google })).toEqual([])
    expect(app({ app_store: apple, google_play: google })).toEqual([])
    expect(app({})).toEqual(invalid)
    expect(app({ app_store: null, google_play: null })).toEqual(invalid)
    for (const bad of [
      "http://apps.apple.com/tr/app/ornek/id1",
      "https://apps.apple.com.evil.test/app",
      "https://evil.test/apps.apple.com",
      "https://user@apps.apple.com/app",
      "https://apps.apple.com:8443/app",
      "https://play.google.com/store",
      "//apps.apple.com/app",
      "javascript:alert(1)",
      "https://apps.apple.com/a b",
    ]) {
      expect(app({ app_store: bad })).toContain(key("footer_block_invalid"))
    }
    expect(app({ google_play: apple })).toContain(key("footer_block_invalid"))
  })

  it("takes a picture only as the media library's address, with its words, linked as a menu links", () => {
    expect(blockIssues(picture({ link: { kind: "system", target: "shop", label: null } }))).toEqual(
      []
    )
    expect(blockIssues(block("image", { image: { url: "/media/a.png" } }))).toHaveLength(1)
    expect(blockIssues(block("image", { image: { url: "/media/a.png", alt: null } }))).toHaveLength(
      1
    )
    expect(
      blockIssues(block("image", { image: { url: "javascript:alert(1)", alt: "A" } }))
    ).toEqual([key("image_invalid")])
    expect(blockIssues(block("image", { image: { url: "//evil.test/a.png", alt: "A" } }))).toEqual([
      key("image_invalid"),
    ])
    expect(
      blockIssues(picture({ link: { kind: "url", url: "http://evil.test", label: "Git" } }))
    ).toEqual(["storefront_menus.url_invalid"])
  })

  it("keeps the rows' and blocks' ids unique in the document, the sections' among them", () => {
    const duplicate = [key("section_duplicate")]
    const twin = menu(2)
    expect(issues(doc([row([[twin, { ...twin, slot: 3 }]])]))).toEqual(duplicate)
    expect(issues(doc([row([[]], { id: "samerow1" }), row([[]], { id: "samerow1" })]))).toEqual(
      duplicate
    )
    expect(issues(doc([row([[menu(1)]], { id: twin.id }), row([[twin]])]))).toEqual(duplicate)
    expect(issues(doc([row([[{ ...menu(1), id: "mainfooter" }]])]))).toEqual(duplicate)
    const home = [{ id: "homefaq01", type: "trust_badges" }]
    expect(issues(doc([row([[{ ...menu(1), id: "homefaq01" }]])], { home }))).toEqual(duplicate)
  })
})
