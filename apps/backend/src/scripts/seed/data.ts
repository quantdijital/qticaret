/**
 * Sector-neutral demo catalog (F1.6). Handles follow docs/13 slug rules:
 * transliterated Turkish, lowercase, [a-z0-9-], at most 80 characters.
 * Prices are gross TRY amounts (KDV included, adr/0007).
 */

export const DEMO_PUBLISHABLE_KEY_TITLE = "Demo storefront"

/** Given to the bootstrap's warehouse when it has no address yet. */
export const DEMO_LOCATION_ADDRESS = {
  address_1: "Caferağa Mahallesi, Moda Caddesi No: 1",
  // F1.4: il in province, ilçe in city
  province: "İstanbul",
  city: "Kadıköy",
  postal_code: "34710",
  country_code: "tr",
} as const

export const DEMO_FULFILLMENT_SET_NAME = "Ana Depo gönderileri"
export const DEMO_SERVICE_ZONE_NAME = "Türkiye"
export const MANUAL_FULFILLMENT_PROVIDER_ID = "manual_manual"

export const DEMO_SHIPPING_OPTIONS = [
  { name: "Standart Kargo", code: "standart", description: "2-4 iş günü", price: 90 },
  { name: "Hızlı Kargo", code: "hizli", description: "1 iş günü", price: 150 },
] as const

export const DEMO_CATEGORIES = [
  { name: "Ev ve Yaşam", handle: "ev-ve-yasam" },
  { name: "Giyim", handle: "giyim" },
  { name: "Gıda", handle: "gida" },
] as const

export type DemoCategoryHandle = (typeof DEMO_CATEGORIES)[number]["handle"]

export interface DemoProduct {
  title: string
  handle: string
  description: string
  category: DemoCategoryHandle
  /** VAT product type (adr/0007); omitted means the default 20% rate. */
  vatProductType?: string
  option: { title: string; values: string[] }
  price: number
  /** Published physical products need them (F3.1); in the store's default units, g and cm. */
  dimensions: { weight: number; length: number; width: number; height: number }
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    title: "Seramik Kupa",
    handle: "seramik-kupa",
    description: "El yapımı, bulaşık makinesinde yıkanabilir 350 ml seramik kupa.",
    category: "ev-ve-yasam",
    option: { title: "Renk", values: ["Beyaz", "Lacivert"] },
    price: 249,
    dimensions: { weight: 350, length: 12, width: 9, height: 10 },
  },
  {
    title: "Keten Masa Örtüsü",
    handle: "keten-masa-ortusu",
    description: "Doğal keten, 140 x 180 cm masa örtüsü.",
    category: "ev-ve-yasam",
    option: { title: "Renk", values: ["Bej", "Gri"] },
    price: 549,
    dimensions: { weight: 600, length: 30, width: 25, height: 3 },
  },
  {
    title: "Pamuklu Tişört",
    handle: "pamuklu-tisort",
    description: "Yüzde yüz pamuk, bisiklet yaka tişört.",
    category: "giyim",
    vatProductType: "KDV %10",
    option: { title: "Beden", values: ["S", "M", "L"] },
    price: 399,
    dimensions: { weight: 200, length: 30, width: 25, height: 2 },
  },
  {
    title: "Organik Tam Buğday Unu 1 kg",
    handle: "organik-tam-bugday-unu-1-kg",
    description: "Taş değirmende öğütülmüş organik tam buğday unu.",
    category: "gida",
    vatProductType: "KDV %1",
    option: { title: "Ağırlık", values: ["1 kg"] },
    price: 89,
    dimensions: { weight: 1000, length: 20, width: 12, height: 6 },
  },
  {
    title: "Bambu Kesme Tahtası",
    handle: "bambu-kesme-tahtasi",
    description: "Tek parça bambudan, meyve suyu oluklu kesme tahtası.",
    category: "ev-ve-yasam",
    option: { title: "Boyut", values: ["Orta", "Büyük"] },
    price: 329,
    dimensions: { weight: 900, length: 40, width: 28, height: 2 },
  },
  {
    title: "Cam Saklama Kabı Seti",
    handle: "cam-saklama-kabi-seti",
    description: "Fırına ve dondurucuya uygun, kilitli kapaklı borosilikat cam kaplar.",
    category: "ev-ve-yasam",
    option: { title: "Set", values: ["3'lü", "5'li"] },
    price: 459,
    dimensions: { weight: 1800, length: 30, width: 22, height: 14 },
  },
  {
    title: "El Dokuma Havlu",
    handle: "el-dokuma-havlu",
    description: "Pamuk ve keten karışımı, tezgâhta dokunmuş 50 x 90 cm havlu.",
    category: "ev-ve-yasam",
    option: { title: "Renk", values: ["Beyaz", "Antrasit"] },
    price: 279,
    dimensions: { weight: 250, length: 25, width: 20, height: 3 },
  },
  {
    title: "Manuel Kahve Değirmeni",
    handle: "manuel-kahve-degirmeni",
    description: "Ayarlanabilir seramik bıçaklı, paslanmaz çelik gövdeli el değirmeni.",
    category: "ev-ve-yasam",
    option: { title: "Model", values: ["Standart"] },
    price: 749,
    dimensions: { weight: 450, length: 20, width: 8, height: 8 },
  },
  {
    title: "Yün Bere",
    handle: "yun-bere",
    description: "Yüzde yüz merinos yünü, ribanalı bere.",
    category: "giyim",
    vatProductType: "KDV %10",
    option: { title: "Renk", values: ["Siyah", "Hardal"] },
    price: 249,
    dimensions: { weight: 90, length: 22, width: 18, height: 2 },
  },
  {
    title: "Keten Gömlek",
    handle: "keten-gomlek",
    description: "Yıkanmış keten, düğmeli yaka, rahat kesim gömlek.",
    category: "giyim",
    vatProductType: "KDV %10",
    option: { title: "Beden", values: ["S", "M", "L"] },
    price: 899,
    dimensions: { weight: 280, length: 32, width: 26, height: 3 },
  },
]

export const DEMO_STOCKED_QUANTITY = 100
