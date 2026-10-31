import { BUNDLE_FORMAT } from "../../src/lib/migration/sources/bundle"

/** A migration bundle for the HTTP tests (F14, adr/0042): every kind, a few edge cases. */

const variant = (key: string, size: string, price: string) => ({
  source_key: key,
  sku: `TAVA-${size}`,
  price,
  stock: 4,
  options: { Boyut: `${size} cm` },
  weight: 1500,
})

/** An old shop: a category path, a brand, two products (one without measurements), people, orders, reviews. */
export const bundle = {
  format: BUNDLE_FORMAT,
  version: 1,
  categories: [{ source_key: "cat-1", path: ["Mutfak", "Tavalar"], old_url: "/kategori/tavalar" }],
  brands: [{ source_key: "brand-1", name: "Demirci", old_url: "/marka/demirci" }],
  products: [
    {
      source_key: "prod-1",
      handle: "tasinan-dokum-tava",
      title: "Taşınan Döküm Tava",
      description: "Ağır döküm gövde.",
      status: "published",
      categories: [["Mutfak", "Tavalar"]],
      brand: "Demirci",
      options: [{ name: "Boyut", values: ["24 cm", "28 cm"] }],
      variants: [variant("v-24", "24", "899.90"), variant("v-28", "28", "1099.90")],
      dimensions: { length: 40, width: 28, height: 8 },
      old_url: "/urun/dokum-tava",
    },
    {
      source_key: "prod-2",
      handle: "tasinan-kapak",
      title: "Taşınan Kapak",
      status: "published",
      variants: [{ source_key: "v-k", sku: "KAPAK-1", price: "249.90" }],
    },
  ],
  customers: [
    {
      source_key: "cus-1",
      email: "Ayse.Tasinan@Example.com",
      first_name: "Ayşe",
      last_name: "Kaya",
      // As the old platform kept it: the platform writes it in E.164
      phone: "0532 123 45 67",
      addresses: [
        {
          address_1: "Atatürk Cd. 1",
          city: "Kadıköy",
          province: "İstanbul",
          phone: "(0532) 123-45-67",
        },
      ],
      marketing: { email: "2025-03-01T10:00:00+03:00" },
    },
    { source_key: "cus-2", email: "zaten@example.com" },
    { source_key: "cus-3", email: "adres-degil" },
  ],
  orders: [
    {
      source_key: "ord-1",
      number: "1001",
      created_at: "2025-05-01T12:00:00+03:00",
      currency: "try",
      total: "899.90",
      status: "Teslim edildi",
      customer_email: "ayse.tasinan@example.com",
      lines: [{ title: "Döküm Tava 24 cm", sku: "TAVA-24", quantity: 1, total: "899.90" }],
    },
    {
      source_key: "ord-2",
      number: "1002",
      created_at: "2025-05-02T12:00:00+03:00",
      currency: "try",
      total: "249.90",
      status: "Teslim edildi",
      customer_email: "misafir@example.com",
      lines: [],
    },
  ],
  reviews: [
    {
      source_key: "rev-1",
      product_source_key: "prod-1",
      author: "Ayşe Kaya",
      customer_email: "ayse.tasinan@example.com",
      rating: 2,
      body: "Ağır ama iyi kızartıyor.",
      published: true,
      created_at: "2025-05-10T09:00:00+03:00",
    },
    {
      source_key: "rev-2",
      product_source_key: "prod-1",
      author: null,
      rating: 5,
      body: "Bekleyen yorum.",
      published: false,
      created_at: "2025-05-11T09:00:00+03:00",
    },
    {
      source_key: "rev-4",
      product_source_key: "prod-1",
      author: "Mehmet Demir",
      rating: 1,
      body: "Daha ucuzu www.baska-magaza.com adresinde.",
      published: true,
      created_at: "2025-05-11T12:00:00+03:00",
    },
    {
      source_key: "rev-3",
      product_source_key: "yok",
      rating: 4,
      body: "Ürünü taşınmayan yorum.",
      published: true,
      created_at: "2025-05-12T09:00:00+03:00",
    },
  ],
  pages: [{ source_key: "page-1", title: "Hakkımızda", old_url: "/hakkimizda" }],
}

export const fileOf = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8")
