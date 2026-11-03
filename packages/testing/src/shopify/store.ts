import type { FakeShopifyData, FakeShopifyNode } from "./fake-server"

/**
 * A tidy Shopify store for a developer's migration runs (adr/0042): what a
 * shop moving to us brings when nothing is wrong with it. Lowercase
 * handles, stock on every variant, one spelling of the brand, customers
 * with Turkish addresses and dated consent, orders, pages and a blog. Its
 * pictures are the fake's own (`${origin}/images/*.png`), so the run's
 * report has no picture errors. Barcodes are in-store numbers (prefix
 * 200, never given to a real product). The tests use `DEMO_SHOPIFY`,
 * whose faults are deliberate.
 */

const gid = (type: string, n: number) => `gid://shopify/${type}/${String(n)}`

const BRAND = "Nehir Ev"
const COLLECTIONS = [
  ["mutfak-tekstili", "Mutfak Tekstili", "<p>Pamuk ve keten <b>mutfak tekstili</b>.</p>"],
  ["banyo", "Banyo", "<p>Havlular, paspaslar ve banyo düzeni.</p>"],
  ["yeni-gelenler", "Yeni Gelenler", ""],
] as const

interface ProductSpec {
  handle: string
  title: string
  description: string
  collections: number[]
  /** The option's name; null for a product sold one way ("Default Title"). */
  option: string | null
  /** Each variant: its option value, SKU, price, price before the sale, stock. */
  variants: [string, string, string, string | null, number][]
  grams: number
}

const PRODUCTS: ProductSpec[] = [
  {
    handle: "pamuklu-havlu-seti",
    title: "Pamuklu Havlu Seti",
    description:
      "<p>Yüzde yüz pamuk, iki banyo ve iki el havlusu.</p><ul><li>60 °C'de yıkanır</li></ul>",
    collections: [2, 3],
    option: "Renk",
    variants: [
      ["Beyaz", "NE-HAVLU-BYZ", "449.90", "529.90", 24],
      ["Antrasit", "NE-HAVLU-ANT", "449.90", "529.90", 18],
    ],
    grams: 900,
  },
  {
    handle: "keten-masa-ortusu",
    title: "Keten Masa Örtüsü",
    description: "<p>Yıkanmış keten, kenarları elde dikilmiş.</p>",
    collections: [1],
    option: "Boyut",
    variants: [
      ["140 x 140 cm", "NE-ORTU-140", "389.90", null, 12],
      ["140 x 200 cm", "NE-ORTU-200", "489.90", null, 9],
    ],
    grams: 450,
  },
  {
    handle: "el-yapimi-seramik-kupa",
    title: "El Yapımı Seramik Kupa",
    description: "<p>Sırlı seramik, 350 ml. Bulaşık makinesinde yıkanır.</p>",
    collections: [1, 3],
    option: null,
    variants: [["Default Title", "NE-KUPA", "189.90", null, 40]],
    grams: 350,
  },
  {
    handle: "bambu-banyo-paspasi",
    title: "Bambu Banyo Paspası",
    description: "<p>Kaymaz tabanlı bambu paspas, 50 x 80 cm.</p>",
    collections: [2],
    option: null,
    variants: [["Default Title", "NE-PASPAS", "279.90", "319.90", 15]],
    grams: 1200,
  },
  {
    handle: "pamuk-mutfak-onlugu",
    title: "Pamuk Mutfak Önlüğü",
    description: "<p>Ayarlanabilir boyun askısı, iki cep.</p>",
    collections: [1],
    option: "Renk",
    variants: [
      ["Hardal", "NE-ONLUK-HRD", "219.90", null, 20],
      ["Lacivert", "NE-ONLUK-LCV", "219.90", null, 16],
    ],
    grams: 300,
  },
]

// In-store EAN-13s (prefix 200), check digits worked out
const BARCODES = [
  "2001004000018",
  "2001004000025",
  "2001004000032",
  "2001004000049",
  "2001004000056",
  "2001004000063",
  "2001004000070",
  "2001004000087",
]

function product(spec: ProductSpec, n: number, origin: string, codes: string[]): FakeShopifyNode {
  const option = spec.option ?? "Title"
  return {
    id: gid("Product", n),
    handle: spec.handle,
    title: spec.title,
    descriptionHtml: spec.description,
    status: "ACTIVE",
    vendor: BRAND,
    seo: { title: `${spec.title} | ${BRAND}`, description: null },
    options: [{ name: option, values: spec.variants.map(([value]) => value) }],
    children: [
      { id: gid("MediaImage", n * 10 + 1), image: { url: `${origin}/images/${spec.handle}.png` } },
      {
        id: gid("MediaImage", n * 10 + 2),
        image: { url: `${origin}/images/${spec.handle}-detay.png` },
      },
      ...spec.collections.map((index) => ({
        id: gid("Collection", index),
        title: COLLECTIONS[index - 1]?.[1] ?? "",
      })),
      ...spec.variants.map(([value, sku, price, compareAtPrice, stock], index) => ({
        id: gid("ProductVariant", n * 10 + index + 1),
        sku,
        barcode: codes.shift() ?? null,
        price,
        compareAtPrice,
        inventoryQuantity: stock,
        selectedOptions: [{ name: option, value }],
        inventoryItem: { measurement: { weight: { unit: "GRAMS", value: spec.grams } } },
      })),
    ],
  }
}

const customer = (
  n: number,
  first: string,
  last: string,
  subscribed: boolean,
  address: { address1: string; city: string; province: string; zip: string }
): FakeShopifyNode => {
  const email = `${first}.${last}`
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[^a-z.]/g, "")
  const phone = `+90532000000${String(n)}`
  return {
    id: gid("Customer", n),
    firstName: first,
    lastName: last,
    createdAt: `2025-0${String(n + 1)}-12T09:30:00Z`,
    defaultEmailAddress: {
      emailAddress: `${email}@example.com`,
      marketingState: subscribed ? "SUBSCRIBED" : "NOT_SUBSCRIBED",
      marketingUpdatedAt: subscribed ? `2025-0${String(n + 1)}-12T09:31:00Z` : null,
    },
    defaultPhoneNumber: {
      phoneNumber: phone,
      smsMarketingConsent: {
        state: subscribed ? "SUBSCRIBED" : "NOT_SUBSCRIBED",
        updatedAt: subscribed ? `2025-0${String(n + 1)}-12T09:31:00Z` : null,
      },
    },
    children: [
      {
        id: gid("MailingAddress", n),
        firstName: first,
        lastName: last,
        company: null,
        address2: null,
        phone,
        countryCodeV2: "TR",
        ...address,
      },
    ],
  }
}

const line = (n: number, title: string, sku: string, quantity: number, amount: string) => ({
  id: gid("LineItem", n),
  title,
  sku,
  quantity,
  discountedTotalSet: { shopMoney: { amount } },
})

const order = (
  n: number,
  email: string,
  date: string,
  fulfilled: boolean,
  lines: FakeShopifyNode[]
): FakeShopifyNode => ({
  id: gid("Order", n),
  name: `#${String(1000 + n)}`,
  createdAt: date,
  currencyCode: "TRY",
  cancelledAt: null,
  email,
  displayFinancialStatus: "PAID",
  displayFulfillmentStatus: fulfilled ? "FULFILLED" : "UNFULFILLED",
  totalPriceSet: {
    shopMoney: {
      amount: lines
        .reduce((sum, each) => {
          const set = each["discountedTotalSet"] as { shopMoney: { amount: string } }
          return sum + Number(set.shopMoney.amount)
        }, 0)
        .toFixed(2),
    },
  },
  customer: { defaultEmailAddress: { emailAddress: email } },
  children: lines,
})

/** The store, its pictures served by the fake at `origin`. */
export function cleanShopifyStore(origin: string): FakeShopifyData {
  const codes = [...BARCODES]
  return {
    currencyCode: "TRY",
    shopName: BRAND,
    collections: COLLECTIONS.map(([handle, title, descriptionHtml], index) => ({
      id: gid("Collection", index + 1),
      handle,
      title,
      descriptionHtml,
    })),
    products: PRODUCTS.map((spec, index) => product(spec, index + 1, origin, codes)),
    customers: [
      customer(1, "Elif", "Kaya", true, {
        address1: "Atatürk Mahallesi, Cumhuriyet Caddesi No: 12 Daire 3",
        city: "Çankaya",
        province: "Ankara",
        zip: "06420",
      }),
      customer(2, "Mehmet", "Demir", false, {
        address1: "Alsancak Mahallesi, Kıbrıs Şehitleri Caddesi No: 45",
        city: "Konak",
        province: "İzmir",
        zip: "35220",
      }),
      customer(3, "Zeynep", "Arslan", true, {
        address1: "Fethiye Mahallesi, Gazcılar Caddesi No: 8",
        city: "Nilüfer",
        province: "Bursa",
        zip: "16140",
      }),
    ],
    orders: [
      order(1, "elif.kaya@example.com", "2025-06-03T10:15:00Z", true, [
        line(1, "Pamuklu Havlu Seti - Beyaz", "NE-HAVLU-BYZ", 1, "449.90"),
        line(2, "El Yapımı Seramik Kupa", "NE-KUPA", 2, "379.80"),
      ]),
      order(2, "mehmet.demir@example.com", "2025-07-21T16:40:00Z", false, [
        line(3, "Keten Masa Örtüsü - 140 x 200 cm", "NE-ORTU-200", 1, "489.90"),
      ]),
      order(3, "zeynep.arslan@example.com", "2025-08-09T08:05:00Z", true, [
        line(4, "Bambu Banyo Paspası", "NE-PASPAS", 1, "279.90"),
      ]),
    ],
    pages: [
      { id: gid("Page", 1), handle: "hakkimizda", title: "Hakkımızda" },
      { id: gid("Page", 2), handle: "iletisim", title: "İletişim" },
      { id: gid("Page", 3), handle: "teslimat-ve-iade", title: "Teslimat ve İade" },
    ],
    blogs: [
      {
        id: gid("Blog", 1),
        handle: "blog",
        title: "Blog",
        children: [
          { id: gid("Article", 1), handle: "havlu-bakimi", title: "Havlu nasıl yumuşak kalır?" },
          { id: gid("Article", 2), handle: "sofrada-keten", title: "Sofrada keten" },
        ],
      },
    ],
  }
}
