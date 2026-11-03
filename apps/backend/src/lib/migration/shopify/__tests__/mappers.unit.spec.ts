import { DEMO_SHOPIFY, jsonlOf } from "@qticaret/testing"
import { nodesOf } from "../bulk"
import { brandsOf, categoriesOf, productsOf } from "../catalog"
import { customersOf, ordersOf, pagesOf } from "../people"

// The demo store's lists as Shopify's bulk files would give them
const file = (list: keyof typeof DEMO_SHOPIFY) =>
  nodesOf(Buffer.from(jsonlOf(DEMO_SHOPIFY[list] as never), "utf8"))

describe("Shopify's bulk files as the common records (F14.2)", () => {
  it("reads collections as categories and products with their variants, pictures and vendors", () => {
    expect(categoriesOf(file("collections"))).toEqual([
      {
        source_key: "gid://shopify/Collection/1",
        path: ["Tavalar"],
        description: "Döküm ve çelik tavalar.",
        old_url: "/collections/tavalar",
      },
      {
        source_key: "gid://shopify/Collection/2",
        path: ["İndirimdekiler"],
        description: null,
        old_url: "/collections/indirimdekiler",
      },
    ])

    const [pan, spoon] = productsOf(file("products"))
    expect(pan).toMatchObject({
      handle: "dokum-tava",
      status: "published",
      // adr/0055: the HTML as a document, its plain text the document's
      description: "Ağır döküm gövde.\n\nFırına girer",
      description_doc: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Ağır döküm gövde." }] },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Fırına girer" }] }],
              },
            ],
          },
        ],
      },
      categories: [["Tavalar"], ["İndirimdekiler"]],
      brand: "Demirci",
      seo_title: "Döküm Tava | Demirci",
      // The video is no picture
      images: ["https://cdn.shopify.com/s/files/tava.jpg"],
      options: [{ name: "Boyut", values: ["24 cm", "28 cm"] }],
      old_url: "/products/dokum-tava",
    })
    expect(pan?.variants.map((variant) => [variant.sku, variant.price, variant.weight])).toEqual([
      ["DEMO-TAVA-24", "899.90", 1500],
      ["DEMO-TAVA-28", "1099.90", 1900],
    ])
    // A handle the platform would refuse is made one; the old one stays for the 301
    expect(spoon).toMatchObject({
      handle: "ahsap-kasik",
      status: "draft",
      options: [],
      old_url: "/products/Ah%C5%9Fap-Ka%C5%9F%C4%B1k",
    })
    expect(spoon?.variants[0]).toMatchObject({
      barcode: "8690000000028",
      compare_at_price: "199.00",
      stock: 0,
      options: {},
      weight: 50,
    })
    // "Demirci" and "demirci" are one brand
    expect(brandsOf(productsOf(file("products")))).toEqual([
      { source_key: "vendor:demirci", name: "Demirci", old_url: null },
    ])
  })

  it("keeps customers' Turkish addresses and only dated consent", () => {
    const [ayse, can] = customersOf(file("customers"))
    expect(ayse).toMatchObject({
      email: "ayse.shopify@example.com",
      phone: "+905321112233",
      addresses: [{ address_1: "Bağdat Cd. 10", city: "Kadıköy", province: "İstanbul" }],
      // SMS consent without a date is none
      marketing: { email: new Date("2024-02-01T10:05:00Z"), sms: null },
    })
    expect(ayse?.addresses).toHaveLength(1)
    expect(can).toMatchObject({ email: "can.shopify@example.com", marketing: null, phone: null })
  })

  it("reads orders in the shop's words, and pages, blogs and articles by their old paths", () => {
    expect(ordersOf(file("orders"))).toMatchObject([
      {
        number: "#1001",
        currency: "try",
        total: "899.90",
        status: "Gönderildi",
        customer_email: "ayse.shopify@example.com",
        lines: [{ title: "Döküm Tava - 24 cm", sku: "DEMO-TAVA-24", quantity: 1, total: "899.90" }],
      },
      { number: "#1002", status: "İptal edildi", customer_email: "misafir.shopify@example.com" },
    ])
    expect(pagesOf(file("pages"), file("blogs")).map((page) => page.old_url)).toEqual([
      "/pages/hakkimizda",
      "/blogs/haberler",
      "/blogs/haberler/tava-bakimi",
    ])
  })

  it("refuses a file line that is not a JSON object", () => {
    expect(() => nodesOf(Buffer.from('{"id":"gid://shopify/Product/1"}\n[1]\n'))).toThrow()
    expect(() => nodesOf(Buffer.from("not json\n"))).toThrow()
  })
})
