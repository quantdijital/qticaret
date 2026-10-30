import type { FakeShopifyData, FakeShopifyNode } from "./fake-server"

/**
 * A small Shopify store in the shape the bulk files have (API 2026-10),
 * for the fake's development runs and the migration tests: two
 * collections, a product with variants and one without options, a
 * customer with dated consent and one abroad, orders, a page, a blog post.
 */

const gid = (type: string, n: number) => `gid://shopify/${type}/${String(n)}`

const variant = (n: number, size: string, price: string, grams: number): FakeShopifyNode => ({
  id: gid("ProductVariant", n),
  sku: `DEMO-TAVA-${size}`,
  barcode: null,
  price,
  compareAtPrice: null,
  inventoryQuantity: 7,
  selectedOptions: [{ name: "Boyut", value: `${size} cm` }],
  inventoryItem: { measurement: { weight: { unit: "GRAMS", value: grams } } },
})

export const DEMO_SHOPIFY: FakeShopifyData = {
  currencyCode: "TRY",
  collections: [
    {
      id: gid("Collection", 1),
      handle: "tavalar",
      title: "Tavalar",
      descriptionHtml: "<p>Döküm ve çelik <b>tavalar</b>.</p>",
    },
    {
      id: gid("Collection", 2),
      handle: "indirimdekiler",
      title: "İndirimdekiler",
      descriptionHtml: "",
    },
  ],
  products: [
    {
      id: gid("Product", 1),
      handle: "dokum-tava",
      title: "Döküm Tava",
      descriptionHtml: "<p>Ağır döküm gövde.</p><ul><li>Fırına girer</li></ul>",
      status: "ACTIVE",
      vendor: "Demirci",
      seo: { title: "Döküm Tava | Demirci", description: null },
      options: [{ name: "Boyut", values: ["24 cm", "28 cm"] }],
      children: [
        { id: gid("MediaImage", 1), image: { url: "https://cdn.shopify.com/s/files/tava.jpg" } },
        { id: gid("Video", 1) },
        { id: gid("Collection", 1), title: "Tavalar" },
        { id: gid("Collection", 2), title: "İndirimdekiler" },
        variant(1, "24", "899.90", 1500),
        variant(2, "28", "1099.90", 1900),
      ],
    },
    {
      id: gid("Product", 2),
      handle: "Ahşap-Kaşık",
      title: "Ahşap Kaşık",
      descriptionHtml: "",
      status: "DRAFT",
      vendor: "demirci",
      seo: { title: null, description: null },
      options: [{ name: "Title", values: ["Default Title"] }],
      children: [
        {
          id: gid("ProductVariant", 3),
          sku: "DEMO-KASIK",
          barcode: "8690000000028",
          price: "149.00",
          compareAtPrice: "199.00",
          inventoryQuantity: -2,
          selectedOptions: [{ name: "Title", value: "Default Title" }],
          inventoryItem: { measurement: { weight: { unit: "KILOGRAMS", value: 0.05 } } },
        },
      ],
    },
  ],
  customers: [
    {
      id: gid("Customer", 1),
      firstName: "Ayşe",
      lastName: "Demir",
      createdAt: "2024-02-01T10:00:00Z",
      defaultEmailAddress: {
        emailAddress: "ayse.shopify@example.com",
        marketingState: "SUBSCRIBED",
        marketingUpdatedAt: "2024-02-01T10:05:00Z",
      },
      defaultPhoneNumber: {
        phoneNumber: "+905321112233",
        smsMarketingConsent: { state: "SUBSCRIBED", updatedAt: null },
      },
      children: [
        {
          id: gid("MailingAddress", 1),
          firstName: "Ayşe",
          lastName: "Demir",
          address1: "Bağdat Cd. 10",
          city: "Kadıköy",
          province: "İstanbul",
          zip: "34710",
          countryCodeV2: "TR",
        },
        {
          id: gid("MailingAddress", 2),
          address1: "Main St 1",
          city: "Berlin",
          countryCodeV2: "DE",
        },
      ],
    },
    {
      id: gid("Customer", 2),
      firstName: "Can",
      lastName: null,
      createdAt: "2024-03-01T10:00:00Z",
      defaultEmailAddress: {
        emailAddress: "can.shopify@example.com",
        marketingState: "NOT_SUBSCRIBED",
        marketingUpdatedAt: null,
      },
      defaultPhoneNumber: null,
    },
  ],
  orders: [
    {
      id: gid("Order", 1),
      name: "#1001",
      createdAt: "2025-01-10T12:00:00Z",
      currencyCode: "TRY",
      cancelledAt: null,
      email: "ayse.shopify@example.com",
      displayFinancialStatus: "PAID",
      displayFulfillmentStatus: "FULFILLED",
      totalPriceSet: { shopMoney: { amount: "899.9" } },
      customer: { defaultEmailAddress: { emailAddress: "ayse.shopify@example.com" } },
      children: [
        {
          id: gid("LineItem", 1),
          title: "Döküm Tava - 24 cm",
          sku: "DEMO-TAVA-24",
          quantity: 1,
          discountedTotalSet: { shopMoney: { amount: "899.90" } },
        },
      ],
    },
    {
      id: gid("Order", 2),
      name: "#1002",
      createdAt: "2025-02-10T12:00:00Z",
      currencyCode: "TRY",
      cancelledAt: "2025-02-11T09:00:00Z",
      email: "misafir.shopify@example.com",
      displayFinancialStatus: "VOIDED",
      displayFulfillmentStatus: "UNFULFILLED",
      totalPriceSet: { shopMoney: { amount: "149.00" } },
      customer: null,
      children: [],
    },
  ],
  pages: [{ id: gid("Page", 1), handle: "hakkimizda", title: "Hakkımızda" }],
  blogs: [
    {
      id: gid("Blog", 1),
      handle: "haberler",
      title: "Haberler",
      children: [{ id: gid("Article", 1), handle: "tava-bakimi", title: "Tava bakımı" }],
    },
  ],
}
