import { CONTENT_LIMITS } from "../../../../../workflows/content/rules"
import { contentDoc } from "../../../../content/doc"
import { wordpressRecords, wordpressSource } from ".."
import { attributeSlug } from "../attributes"
import { wxrFixture } from "./wxr"

describe("a WordPress export as the common records (adr/0042 Ek 2026-11-03)", () => {
  const records = wordpressRecords(wxrFixture())
  const notesOf = (key: string) =>
    records.notes.filter((note) => note.key === key).map((note) => note.source_key)

  it("names the source by the old site's host and reads the archives' bases from its links", () => {
    expect(records.id).toBe("wordpress:eski.example.com")
    // Categories at the root (an SEO plugin took the base off), brands under /marka/; blog ones as WordPress's
    expect(records.bases).toEqual({
      category: "/",
      brand: "/marka/",
      postCategory: "/category/",
      postTag: "/tag/",
    })
    expect(
      wordpressRecords(wxrFixture(), { categoryBase: "urun-kategori" }).categories[1]
    ).toMatchObject({
      old_url: "/urun-kategori/mutfak/tavalar/",
    })
  })

  it("gives categories as paths from the top, their text, SEO fields, and brands", () => {
    expect(records.categories).toEqual([
      // A theme's block under the products stands for a category without a description
      {
        source_key: "product_cat:mutfak",
        path: ["Mutfak & Şef"],
        handle: "mutfak",
        description: "Mutfak için her şey.",
        // A title of the plugin's variables only: the shop's templates give it one, as the panel's
        seo_title: null,
        seo_description: null,
        focus_keyword: null,
        old_url: "/mutfak/",
      },
      {
        source_key: "product_cat:tavalar",
        path: ["Mutfak & Şef", "Tavalar"],
        handle: "tavalar",
        description: "Döküm tavalar.",
        // The SEO plugin's own, its variables filled in
        seo_title: "Tavalar Modelleri - Örnek Ev & Mutfak",
        seo_description: "Her ocağa uygun döküm tavalar.",
        focus_keyword: "döküm tava",
        old_url: "/mutfak/tavalar/",
      },
    ])
    expect(records.brands).toEqual([
      { source_key: "product_brand:demirci", name: "Demirci", old_url: "/marka/demirci/" },
    ])
  })

  it("decodes a percent-encoded Turkish slug before making it a handle; a broken one stays as written", () => {
    const encoded = wordpressRecords(wxrFixture().replaceAll("tavalar", "%c3%a7akilar"))
    expect(encoded.categories[1]).toMatchObject({
      source_key: "product_cat:çakilar",
      handle: "cakilar",
    })
    const broken = wordpressRecords(wxrFixture().replaceAll("tavalar", "%e0tavalar"))
    expect(broken.categories[1]).toMatchObject({
      source_key: "product_cat:%e0tavalar",
      handle: "e0tavalar",
    })
  })

  it("makes a variable product's attributes options and its variations variants", () => {
    const [pan] = records.products
    expect(pan).toMatchObject({
      source_key: "product:10",
      handle: "dokum-tava",
      title: "Döküm Tava",
      status: "published",
      // The SEO plugin's primary category first
      categories: [["Mutfak & Şef", "Tavalar"], ["Mutfak & Şef"]],
      brand: "Demirci",
      // A title of the plugin's variables only is the shop's template's
      seo_title: null,
      seo_description: "Ağır döküm tava & kapak.",
      focus_keyword: "döküm tava",
      options: [
        { name: "Renk", values: ["Kırmızı", "Mavi"] },
        { name: "Boyut", values: ["24 cm", "28 cm"] },
      ],
      dimensions: { length: 30, width: 30, height: 8 },
      old_url: "/urun/dokum-tava/",
    })
    expect(pan?.variants).toEqual([
      {
        source_key: "variation:11",
        sku: "TAVA-K-24",
        barcode: null,
        price: "899.90",
        compare_at_price: "1000.00",
        stock: 5,
        options: { Renk: "Kırmızı", Boyut: "24 cm" },
        // The product's 1.5 kg where the variation has none
        weight: 1500,
        // Its own picture, tied to it here; the other variation has none
        image: "https://eski.example.com/wp-content/uploads/2026/01/kirmizi.png",
      },
      {
        source_key: "variation:12",
        sku: "TAVA-M-28",
        barcode: null,
        price: "1200.00",
        compare_at_price: null,
        stock: 0,
        options: { Renk: "Mavi", Boyut: "28 cm" },
        weight: 1800,
      },
    ])
    // The main picture, the gallery, the variations' own; the old alt text kept
    const upload = (name: string) => `https://eski.example.com/wp-content/uploads/2026/01/${name}`
    expect(pan?.images).toEqual([upload("tava.png"), upload("tava-yan.png"), upload("kirmizi.png")])
    expect(pan?.image_alts).toEqual({ [upload("tava.png")]: "Döküm tava önden" })
  })

  it("keeps a page builder's description as a document, its scripts and grids gone (adr/0055)", () => {
    const [pan] = records.products
    const cell = (type: "tableHeader" | "tableCell", text: string) => ({
      type,
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    })
    expect(pan?.description_doc).toEqual({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Özellikler" }] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Döküm " },
                    { type: "text", text: "gövde", marks: [{ type: "bold" }] },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "24 ve 28 cm" }] }],
            },
          ],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [cell("tableHeader", "Ölçü"), cell("tableCell", "28 cm")],
            },
            {
              type: "tableRow",
              content: [cell("tableHeader", "Ağırlık"), cell("tableCell", "1,5 kg")],
            },
          ],
        },
      ],
    })
    // The plain text is the document's: blocks apart, items and rows a line each
    expect(pan?.description).toBe(
      "Özellikler\n\nDöküm gövde\n24 ve 28 cm\n\nÖlçü · 28 cm\nAğırlık · 1,5 kg"
    )
  })

  it("gives a product without a body no document", () => {
    const plain = records.products.find((product) => product.description === null)
    expect(plain?.description_doc ?? null).toBeNull()
    // No excerpt: no short description either
    expect(
      records.products.find((product) => product.source_key === "product:10")?.summary_doc
    ).toBe(null)
  })

  it("moves a simple product as one variant, hidden and unpublished ones as drafts", () => {
    const byKey = new Map(records.products.map((product) => [product.source_key, product]))
    expect(byKey.get("product:20")).toMatchObject({
      description: "El yapımı kaşık.",
      // adr/0055 Ek 2026-11-06: the excerpt is the short description too, as written
      summary_doc: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "El yapımı kaşık." }] }],
      },
      options: [],
      // Not counted, on sale: always sellable here (adr/0042 Ek 2026-11-20)
      variants: [{ source_key: "variant:20", sku: "KASIK-1", price: "149.90", stock: "untracked" }],
    })
    expect(byKey.get("product:30")?.status).toBe("draft")
    expect(byKey.get("product:31")).toMatchObject({ status: "draft", old_url: null })
    expect(byKey.has("product:32")).toBe(false)
    expect(byKey.has("product:33")).toBe(false)
  })

  it("gives each product's descriptive attributes, matched by their slug", () => {
    const byKey = new Map(records.products.map((product) => [product.source_key, product]))
    // The variation attributes are options; the others the template's
    expect(byKey.get("product:10")?.attributes).toEqual([
      { key: "pa_desen", slug: "desen", name: "Desen", values: ["Çizgili"] },
      { key: "pa_malzeme", slug: "malzeme", name: "Malzeme", values: ["Döküm Demir"] },
    ])
    expect(byKey.get("product:20")?.attributes).toEqual([
      { key: "malzeme", slug: "malzeme", name: "Malzeme", values: ["Kayın", "Ceviz"] },
    ])
    expect(byKey.get("product:30")?.attributes).toEqual([])
    // A product's own attribute is keyed by its name as WordPress slugs it, percent-encoded
    expect(attributeSlug("%c3%bcretim-yeri")).toBe("uretim-yeri")
    expect(attributeSlug("pa_sap-rengi")).toBe("sap-rengi")
    expect(attributeSlug("pa_%")).toBe("")
  })

  it("names what it left out", () => {
    expect(notesOf("migration.wordpress_trashed")).toEqual(["product:32"])
    expect(notesOf("migration.wordpress_product_type")).toEqual(["product:33"])
    expect(notesOf("migration.wordpress_variation_disabled")).toEqual(["variation:13"])
    expect(notesOf("migration.wordpress_variation_orphan")).toEqual(["variation:14"])
    expect(notesOf("migration.wordpress_image_missing")).toEqual(["product:10 #999"])
    // Whether an attribute moves is the run's to say: it knows the shop's templates
    expect(notesOf("migration.wordpress_attribute_not_moved")).toEqual([])
    expect(notesOf("migration.wordpress_product_tags")).toEqual([
      "product_tag: 1 etiket, 1 tanesi tek üründe",
    ])
    expect(notesOf("migration.wordpress_menus")).toEqual(["nav_menu_item: 1 öğe"])
    expect(notesOf("migration.wordpress_coupons")).toEqual(["shop_coupon: 1 kupon"])
    expect([...records.attributes.keys()]).toEqual(["pa_desen", "pa_malzeme", "malzeme"])
  })

  it("moves rated reviews only, a waiting one waiting, without the writer's e-mail", () => {
    expect(records.reviews).toEqual([
      {
        source_key: "comment:901",
        product_source_key: "product:10",
        author: "Ayşe Yılmaz",
        customer_email: null,
        rating: 5,
        title: null,
        body: "Çok iyi tava.",
        published: true,
        created_at: new Date("2025-06-01T10:00:00Z"),
      },
      expect.objectContaining({ source_key: "comment:902", rating: 4, published: false }),
    ])
    expect(notesOf("migration.wordpress_comment_not_review")).toEqual(["comment:904"])
  })

  it("makes a post with its primary category, its tags, cover and SEO fields", () => {
    const [post] = records.posts
    expect(post).toMatchObject({
      source_key: "post:40",
      title: "Tava Bakımı",
      old_url: "/tava-bakimi/",
      category: {
        source_key: "category:rehberler",
        name: "Rehberler",
        handle: "rehberler",
        description: "Bakım ve kullanım rehberleri.",
        seo_title: "Rehberler - Örnek Ev & Mutfak",
        old_url: "/category/rehberler/",
      },
      content: {
        handle: "tava-bakimi",
        excerpt: "Tavanızı uzun yıllar kullanın.",
        author: "Örnek Yazar",
        status: "published",
        published_at: new Date("2024-03-01T07:30:00Z"),
        cover: {
          url: "https://eski.example.com/wp-content/uploads/2026/01/kapak.png",
          alt: "Tava bakımı kapak",
        },
        seo_title: "Tava Bakımı Rehberi - Örnek Ev & Mutfak",
        seo_description: "Döküm tava nasıl temizlenir?",
      },
    })
    // A shortcode's debris is no tag
    expect(post?.tags.map((tag) => [tag.name, tag.handle, tag.old_url])).toEqual([
      ["döküm", "dokum", "/tag/dokum/"],
      ["bakım", "bakim", "/tag/bakim/"],
    ])
    expect(notesOf("migration.wordpress_term_unread")).toEqual(["post_tag:sss-item-x"])
    expect(notesOf("migration.wordpress_post_categories")).toEqual(["post:40"])
    // The picture in the body is left out and named; the question a heading; old links paths here
    expect(notesOf("migration.wordpress_body_media")).toEqual(["post:40"])
    const body = post?.content.body
    expect(contentDoc.safeParse(body).success).toBe(true)
    expect(body?.content.map((block) => block.type)).toEqual(["paragraph", "heading", "paragraph"])
    expect(JSON.stringify(body)).toContain('"href":"/urun/dokum-tava"')
  })

  it("makes content pages of the site's own pages; legal, system and front pages keep their address only", () => {
    const byKey = new Map(records.pages.map((page) => [page.source_key, page]))
    expect(byKey.get("page:50")).toMatchObject({
      title: "Hakkımızda",
      old_url: "/hakkimizda/",
      content: { handle: "hakkimizda", status: "published" },
    })
    // Its own h1 repeats the title: left out
    expect(byKey.get("page:50")?.content?.body.content.map((block) => block.type)).toEqual([
      "paragraph",
    ])
    expect(byKey.get("page:51")).toEqual({
      source_key: "page:51",
      title: "Satış Sözleşmesi",
      old_url: "/satis-sozlesmesi/",
    })
    expect(byKey.get("page:52")?.content).toBeUndefined()
    expect(byKey.has("page:53")).toBe(false)
    // Kept out of search there: a draft here
    expect(byKey.get("page:54")?.content).toMatchObject({
      status: "draft",
      robots: "noindex_nofollow",
    })
    expect(notesOf("migration.wordpress_page_legal")).toEqual(["page:51"])
    expect(notesOf("migration.wordpress_page_system")).toEqual(["page:52"])
    expect(notesOf("migration.wordpress_page_front")).toEqual(["page:53"])
    expect(notesOf("migration.wordpress_noindex_draft")).toEqual(["page:54"])
  })

  it("keeps a content entry's text within what the content workflow takes", () => {
    expect(CONTENT_LIMITS).toMatchObject({ title: 200, excerpt: 500, author: 120, imageAlt: 300 })
  })

  it("gives every kind as a source, people none", async () => {
    const source = wordpressSource(wxrFixture())
    const count = async <T>(list: AsyncIterable<T>) => {
      const all: T[] = []
      for await (const item of list) {
        all.push(item)
      }
      return all.length
    }
    expect(source.id).toBe("wordpress:eski.example.com")
    expect(await count(source.products())).toBe(4)
    const posts = source.posts?.()
    expect(posts && (await count(posts))).toBe(1)
    expect(await count(source.customers())).toBe(0)
    expect(await count(source.orders())).toBe(0)
    expect(source.notes?.().length).toBe(records.notes.length)
  })
})
