import { layoutDocument } from "../layout"
import { mainSectionsOf, withMainSections } from "../layout-main"
import { freeBlocksOf } from "../sections/footer-rules"
import {
  footerRowDocs,
  footerRowImages,
  footerRowLinks,
  plainRowTools,
} from "../sections/footer-rows-print"

const LEFT = { layout: "left", sticky: true } as const
type Fields = Record<string, unknown>
const footer = (more: Fields = {}) => ({
  id: "mainfooter",
  type: "footer_bar",
  variant: "free_rows",
  ...more,
})
const read = (document: unknown) => withMainSections(layoutDocument.parse(document), LEFT)

const LINK = { kind: "category", target: "pcat_01", label: null } as const
const ROWS = [
  {
    id: "rowtop001",
    layout: "1-1",
    ground: "page",
    space: "small",
    divider: true,
    columns: [
      {
        blocks: [
          { id: "hidden001", type: "social", visible: false },
          {
            id: "words0001",
            type: "text",
            title: "Kargo",
            body: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "<b>14.00</b> & sonrası", marks: [{ type: "bold" }] },
                  ],
                },
              ],
            },
          },
        ],
      },
      {
        blocks: [{ id: "gone00001", type: "image", image: { url: "/media/gone.png", alt: "Yok" } }],
      },
    ],
  },
  {
    id: "rowmain01",
    layout: "2-1-1",
    columns: [
      {
        blocks: [
          {
            id: "news00001",
            type: "newsletter",
            title: "Bülten",
            text: "{mağaza_adı} e-postaları",
            variant: "in_footer",
          },
        ],
      },
      { blocks: [{ id: "menu00001", type: "menu", slot: 2, device: "desktop" }] },
      {
        blocks: [
          {
            id: "pict00001",
            type: "image",
            image: { url: "/media/rozet.png", alt: "Güven rozeti" },
            width: "small",
            link: LINK,
          },
          {
            id: "apps00001",
            type: "app_badges",
            app_store: "https://apps.apple.com/tr/app/ornek/id000000000",
          },
        ],
      },
    ],
  },
]

describe("the free rows footer as the storefront reads it (adr/0070 §2.2)", () => {
  const doc = read({ footer: [footer({ rows: ROWS, social: "icons", ground: "stage" })] })
  const shown = {
    url: "/media/rozet.png",
    alt: "Kütüphane",
    width: 120,
    height: 60,
    derivatives: null,
  }
  const printed = mainSectionsOf(doc, () => null, {
    fill: (text) => (text === null ? null : text.replace("{mağaza_adı}", "Örnek")),
    doc: (body) => body,
    picture: (url) => (url === shown.url ? shown : null),
    resolve: (link) => (link.kind === "category" ? "resolved" : null),
  }).footer_bar

  it("prints the variant's settings and every row, the footer's own only where changed", () => {
    expect(printed).toMatchObject({
      id: "mainfooter",
      type: "footer_bar",
      variant: "free_rows",
      social: "icons",
      ground: "stage",
      badge_style: "card",
      bottom_badges: true,
    })
    expect(printed).not.toHaveProperty("payment_badges")
    expect("rows" in printed ? printed.rows : []).toMatchObject([
      {
        id: "rowtop001",
        layout: "1-1",
        ground: "page",
        space: "small",
        align: "start",
        phone_columns: 1,
        divider: true,
      },
      {
        id: "rowmain01",
        layout: "2-1-1",
        ground: "inherit",
        space: "medium",
        align: "start",
        phone_columns: 1,
        divider: false,
      },
    ])
  })

  it("leaves out a hidden block and one whose picture is gone, the column keeping its place", () => {
    const columns = "rows" in printed ? printed.rows.flatMap((row) => row.columns) : []
    expect(
      columns.map((column) => column.blocks.map((block) => `${block.id}@${String(block.at)}`))
    ).toEqual([
      ["words0001@1"],
      [],
      ["news00001@3"],
      ["menu00001@4"],
      ["pict00001@5", "apps00001@6"],
    ])
  })

  it("draws a text block's document as the backend's HTML, every word escaped", () => {
    const [top] = "rows" in printed ? printed.rows : []
    expect(top?.columns[0]?.blocks[0]).toEqual({
      id: "words0001",
      at: 1,
      device: "all",
      type: "text",
      title: "Kargo",
      html: "<p><strong>&lt;b&gt;14.00&lt;/b&gt; &amp; sonrası</strong></p>",
      style: "plain",
    })
  })

  it("resolves a picture and its link, fills the shop's details and passes a menu's slot on", () => {
    const [, main] = "rows" in printed ? printed.rows : []
    expect(main?.columns.flatMap((column) => column.blocks)).toEqual([
      {
        id: "news00001",
        at: 3,
        device: "all",
        type: "newsletter",
        title: "Bülten",
        text: "Örnek e-postaları",
        description: null,
        variant: "in_footer",
      },
      {
        id: "menu00001",
        at: 4,
        device: "desktop",
        type: "menu",
        slot: 2,
        title: null,
        collapse_phone: true,
      },
      {
        id: "pict00001",
        at: 5,
        device: "all",
        type: "image",
        image: { ...shown, alt: "Güven rozeti" },
        width: "small",
        link: "resolved",
      },
      {
        id: "apps00001",
        at: 6,
        device: "all",
        type: "app_badges",
        app_store: "https://apps.apple.com/tr/app/ornek/id000000000",
        google_play: null,
      },
    ])
  })

  it("prints a broken link as none, the picture staying", () => {
    const plain = mainSectionsOf(doc).footer_bar
    const picture = ("rows" in plain ? plain.rows : [])
      .flatMap((row) => row.columns.flatMap((column) => column.blocks))
      .find((block) => block.id === "pict00001")
    expect(picture).toMatchObject({ type: "image", link: null, image: { url: "/media/rozet.png" } })
    expect(plainRowTools(() => null).fill("x")).toBe("x")
  })

  it("names the blocks' pictures, links and documents for the save's checks, hidden ones too", () => {
    const all = freeBlocksOf(doc.footer)
    expect(all).toHaveLength(7)
    expect(footerRowImages(all)).toEqual(["/media/gone.png", "/media/rozet.png"])
    expect(footerRowLinks(all)).toEqual([LINK])
    expect(footerRowDocs(all)).toHaveLength(1)
    expect(freeBlocksOf(read({ footer: [footer({ variant: "ledger" })] }).footer)).toEqual([])
  })

  it("leaves the ledger's and the brand columns' print as it was", () => {
    expect(
      mainSectionsOf(read({ footer: [{ id: "mainfooter", type: "footer_bar" }] })).footer_bar
    ).toEqual({
      id: "mainfooter",
      type: "footer_bar",
      variant: "ledger",
    })
    const columns = mainSectionsOf(
      read({ footer: [footer({ variant: "brand_columns" })] })
    ).footer_bar
    expect(Object.keys(columns)).toEqual(["id", "type", "variant", "columns"])
  })
})
