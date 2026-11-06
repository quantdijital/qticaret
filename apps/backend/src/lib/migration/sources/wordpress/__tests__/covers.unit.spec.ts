import { wordpressRecords } from ".."
import { coverAlt, thumbnailIdOf } from "../covers"
import type { WxrItem } from "../reader"
import { wxrFixture } from "./wxr"

const attachment = (own: Partial<WxrItem> & { meta?: Map<string, string> }): WxrItem => ({
  id: "1",
  type: "attachment",
  status: "inherit",
  title: "",
  link: "",
  slug: "",
  parent: "0",
  order: 0,
  date: null,
  content: "",
  excerpt: "",
  author: null,
  password: false,
  terms: [],
  meta: new Map(),
  comments: [],
  attachmentUrl: "https://eski.example.com/wp-content/uploads/2026/03/IMG_2026-scaled.jpg",
  ...own,
})

describe("a product category's own picture in a WordPress export (adr/0042 Ek 2026-11-06)", () => {
  it("reads the term's thumbnail_id as an attachment id; none for none, 0 or no id", () => {
    const of = (value?: string) =>
      thumbnailIdOf(new Map(value === undefined ? [] : [["thumbnail_id", value]]))
    expect(of("3878")).toBe("3878")
    expect(of(" 12 ")).toBe("12")
    expect(of("0")).toBeNull()
    expect(of("")).toBeNull()
    expect(of("abc")).toBeNull()
    expect(of("12a")).toBeNull()
    expect(of()).toBeNull()
  })

  it("takes the media library's alt, else a real title, else the category's name", () => {
    expect(
      coverAlt(
        attachment({
          title: "Bıçak seti",
          meta: new Map([["_wp_attachment_image_alt", "  El yapımı\nbıçaklar "]]),
        }),
        "Bıçaklar"
      )
    ).toBe("El yapımı bıçaklar")
    expect(coverAlt(attachment({ title: "Şef bıçakları" }), "Bıçaklar")).toBe("Şef bıçakları")
    // WordPress titles an upload with its file's name: no alt text (its size suffix aside)
    expect(coverAlt(attachment({ title: "IMG_2026" }), "Bıçaklar")).toBe("Bıçaklar")
    expect(
      coverAlt(
        attachment({
          title: "kamp-bicagi",
          attachmentUrl: "https://eski.example.com/wp-content/uploads/kamp-bicagi-300x200.webp",
        }),
        "Kamp"
      )
    ).toBe("Kamp")
    // A name WordPress numbered, and a slug-like title: file names, not descriptions
    expect(
      coverAlt(
        attachment({
          title: "Kamp Malzemeleri",
          attachmentUrl: "https://eski.example.com/wp-content/uploads/kamp-malzemeleri-1.webp",
        }),
        "Kamp"
      )
    ).toBe("Kamp")
    expect(coverAlt(attachment({ title: "my-larte-el-yapımı-çakı" }), "El Yapımı Çakı")).toBe(
      "El Yapımı Çakı"
    )
    expect(coverAlt(attachment({ title: "" }), "Mutfak & Şef")).toBe("Mutfak & Şef")
  })

  it("resolves each category's picture through the media library; a missing one is a note", () => {
    const records = wordpressRecords(wxrFixture("https://eski.example.com", { covers: true }))
    const byKey = new Map(records.categories.map((category) => [category.source_key, category]))
    expect(byKey.get("product_cat:mutfak")).toMatchObject({
      image: {
        url: "https://eski.example.com/wp-content/uploads/2026/01/mutfak.png",
        // Titled as its file: the category's name
        alt: "Mutfak & Şef",
      },
    })
    expect(byKey.get("product_cat:tavalar")).toMatchObject({
      image: {
        url: "https://eski.example.com/wp-content/uploads/2026/01/tava.png",
        alt: "Döküm tava önden",
      },
    })
    expect(byKey.get("product_cat:kasiklar")).toMatchObject({
      path: ["Mutfak & Şef", "Kaşıklar"],
      image_missing: "999",
    })
    expect(byKey.get("product_cat:kasiklar")).not.toHaveProperty("image")
    expect(
      records.notes.filter((note) => note.key === "migration.wordpress_category_image_missing")
    ).toEqual([
      {
        kind: "category",
        source_key: "product_cat:kasiklar #999",
        key: "migration.wordpress_category_image_missing",
      },
    ])
  })

  it("gives no picture where the export names none", () => {
    const records = wordpressRecords(wxrFixture())
    for (const category of records.categories) {
      expect(category).not.toHaveProperty("image")
      expect(category).not.toHaveProperty("image_missing")
    }
  })
})
