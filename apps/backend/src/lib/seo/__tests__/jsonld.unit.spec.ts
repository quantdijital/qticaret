import { z } from "@medusajs/framework/zod"
import { breadcrumbJsonLd, listingJsonLd, productJsonLd, siteJsonLd } from "../jsonld"
import type { ProductFacts, VariantFacts } from "../jsonld"

// The contract (docs/13 §5): what Google needs of each block, written as schemas
const absoluteUrl = z.string().regex(/^https:\/\/[^/\s]+\/\S*$/)
const offer = z
  .object({
    "@type": z.literal("Offer"),
    url: absoluteUrl,
    price: z.string().regex(/^\d+\.\d{2}$/),
    priceCurrency: z.literal("TRY"),
    // A discount's price before it (F4.3): Google's strikethrough price
    priceSpecification: z
      .object({
        "@type": z.literal("UnitPriceSpecification"),
        priceType: z.literal("https://schema.org/StrikethroughPrice"),
        price: z.string().regex(/^\d+\.\d{2}$/),
        priceCurrency: z.literal("TRY"),
      })
      .strict()
      .optional(),
    availability: z
      .string()
      .regex(/^https:\/\/schema\.org\/(InStock|OutOfStock|BackOrder|PreOrder)$/),
    itemCondition: z.string().regex(/^https:\/\/schema\.org\/\w+Condition$/),
  })
  .strict()
const product = z.object({
  "@type": z.literal("Product"),
  name: z.string().min(1),
  sku: z.string().regex(/^\S+$/).optional(),
  gtin: z
    .string()
    .regex(/^\d{8,14}$/)
    .optional(),
  image: z.array(absoluteUrl).optional(),
  offers: offer.optional(),
})
const productGroup = z.object({
  "@context": z.literal("https://schema.org"),
  "@type": z.literal("ProductGroup"),
  name: z.string().min(1),
  productGroupID: z.string().min(1),
  variesBy: z.array(z.string().regex(/^https:\/\/schema\.org\/\w+$/)).min(1),
  hasVariant: z.array(product.extend({ offers: offer })).min(2),
  brand: z.object({ "@type": z.literal("Brand"), name: z.string().min(1) }).optional(),
})
const breadcrumbs = z.object({
  "@context": z.literal("https://schema.org"),
  "@type": z.literal("BreadcrumbList"),
  itemListElement: z
    .array(
      z.object({
        "@type": z.literal("ListItem"),
        position: z.number().int().positive(),
        name: z.string().min(1),
        item: absoluteUrl,
      })
    )
    .min(2),
})

const variant = (overrides: Partial<VariantFacts> = {}): VariantFacts => ({
  id: "variant_01",
  name: "Keten Gömlek – M",
  sku: "GMLK-M",
  gtin: "8690000000012",
  mpn: null,
  image: null,
  price: 899,
  availability: "InStock",
  properties: { size: "M" },
  ...overrides,
})

const facts = (overrides: Partial<ProductFacts> = {}): ProductFacts => ({
  name: "Keten Gömlek",
  description: "Yıkanmış ketenden rahat kesim gömlek.",
  images: ["https://cdn.example.com/gomlek.webp"],
  brand: "Örnek Marka",
  condition: "new",
  groupId: "keten-gomlek",
  variesBy: ["size"],
  variants: [variant()],
  ...overrides,
})

const URL = "https://magaza.example.com/urun/keten-gomlek"

describe("productJsonLd", () => {
  it("writes one variant as a Product with its Offer", () => {
    const block = productJsonLd(facts(), URL)
    expect(
      product.extend({ "@context": z.literal("https://schema.org") }).parse(block)
    ).toBeTruthy()
    expect(block).toMatchObject({
      brand: { "@type": "Brand", name: "Örnek Marka" },
      offers: { price: "899.00", url: URL, itemCondition: "https://schema.org/NewCondition" },
    })
  })

  it("adds a discount's price before it as a strikethrough price, never one not above it", () => {
    const sale = productJsonLd(
      facts({ variants: [variant({ price: 799, strikethrough: 899 })] }),
      URL
    )
    expect(product.parse(sale)).toBeTruthy()
    expect(sale).toMatchObject({
      offers: {
        price: "799.00",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          priceType: "https://schema.org/StrikethroughPrice",
          price: "899.00",
          priceCurrency: "TRY",
        },
      },
    })
    for (const strikethrough of [799, 700, null]) {
      const plain = productJsonLd(
        facts({ variants: [variant({ price: 799, strikethrough })] }),
        URL
      )
      expect(JSON.stringify(plain)).not.toContain("priceSpecification")
    }
  })

  it("writes several as a ProductGroup, each variant preselected by its URL", () => {
    const block = productJsonLd(
      facts({
        variants: [
          variant(),
          variant({
            id: "variant_02",
            name: "Keten Gömlek – L",
            sku: "GMLK-L",
            gtin: null,
            price: 949.5,
            availability: "OutOfStock",
            properties: { size: "L" },
          }),
        ],
      }),
      URL
    )
    const group = productGroup.parse(block)
    expect(group.variesBy).toEqual(["https://schema.org/size"])
    expect(block).toMatchObject({
      hasVariant: [
        { size: "M", offers: { url: `${URL}?variant=variant_01` } },
        {
          size: "L",
          offers: { price: "949.50", availability: "https://schema.org/OutOfStock" },
        },
      ],
    })
  })

  it("leaves out what a product does not have, and an offer without a price", () => {
    const block = productJsonLd(
      facts({
        brand: null,
        images: [],
        variants: [variant({ gtin: null, sku: null, price: null })],
      }),
      URL
    )
    expect(block).not.toHaveProperty("brand")
    expect(block).not.toHaveProperty("image")
    expect(block).not.toHaveProperty("gtin")
    expect(block).not.toHaveProperty("offers")
  })
})

describe("listing, breadcrumb and site blocks", () => {
  it("lists a category's first products in order", () => {
    const block = listingJsonLd(
      {
        name: "Giyim",
        description: "",
        items: [
          { name: "Keten Gömlek", url: URL },
          { name: "Pamuklu Tişört", url: "https://magaza.example.com/urun/pamuklu-tisort" },
        ],
      },
      "https://magaza.example.com/kategori/giyim"
    )
    expect(block).toMatchObject({
      "@type": "CollectionPage",
      mainEntity: { itemListElement: [{ position: 1, url: URL }, { position: 2 }] },
    })
    expect(block).not.toHaveProperty("description")
  })

  it("numbers breadcrumbs from the root, and skips a trail of one", () => {
    const crumbs = [
      { name: "Giyim", url: "https://magaza.example.com/kategori/giyim" },
      { name: "Keten Gömlek", url: URL },
    ]
    expect(breadcrumbs.parse(breadcrumbJsonLd(crumbs))).toBeTruthy()
    expect(breadcrumbJsonLd(crumbs.slice(1))).toBeNull()
  })

  it("describes the shop as an OnlineStore and a WebSite without a search action", () => {
    const [store, site] = siteJsonLd({
      name: "Demo Mağaza",
      url: "https://magaza.example.com/",
      logo: null,
    })
    expect(store).toEqual({
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      name: "Demo Mağaza",
      url: "https://magaza.example.com/",
    })
    expect(site).not.toHaveProperty("potentialAction")
  })
})
