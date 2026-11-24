import type { PanelMapEntry } from "./types.js"

/** The jobs people start most (the command menu's shortcuts, docs/06 §5) and the common asks. */
export const ACTION_ENTRIES = [
  {
    key: "products.new",
    parent: "products",
    path: "/products/new",
    label: "command.shortcuts.addProduct",
    keywords: {
      tr: ["yeni ürün", "ürün yükle", "ürün oluştur"],
      en: ["new product", "create product", "add item"],
    },
    help: {
      tr: "Yeni bir ürünün adını, fiyatını, görsellerini ve stoğunu girersiniz.",
      en: "Enter a new product's name, price, pictures and stock.",
    },
  },
  {
    key: "orders.toShip",
    parent: "orders",
    path: "/orders",
    search: { stage: "to_ship" },
    label: "command.shortcuts.toShip",
    keywords: {
      tr: ["kargolanacak", "gönderilecek siparişler", "bekleyen sipariş", "paketlenecek"],
      en: ["to ship", "unfulfilled", "pending orders"],
    },
    help: {
      tr: "Ödemesi alınmış, kargoya verilmeyi bekleyen siparişler.",
      en: "Paid orders waiting to be shipped.",
    },
  },
  {
    key: "inventory.low",
    parent: "inventory",
    path: "/inventory",
    search: { view: "low" },
    label: "command.shortcuts.lowStock",
    keywords: {
      tr: ["biten ürün", "stok azaldı", "tükenmek üzere", "stoğu az"],
      en: ["low stock", "running out", "out of stock"],
    },
    help: {
      tr: "Stoğu azalan ya da biten ürünler; adetlerini buradan düzeltirsiniz.",
      en: "Products running low or out, to correct their quantities.",
    },
  },
  {
    key: "promotions.new",
    parent: "promotions",
    path: "/promotions/new",
    label: "command.shortcuts.addPromotion",
    keywords: {
      tr: ["indirim yap", "kupon oluştur", "indirim kodu oluştur", "yeni kampanya"],
      en: ["create discount", "new coupon", "new promotion"],
    },
    help: {
      tr: "Yeni bir indirim kodu ya da otomatik kampanya kurarsınız.",
      en: "Set up a new discount code or automatic promotion.",
    },
  },
  {
    key: "categories.new",
    parent: "categories",
    path: "/categories",
    search: { selected: "new" },
    label: "command.shortcuts.addCategory",
    keywords: {
      tr: ["yeni kategori", "kategori oluştur"],
      en: ["new category", "create category"],
    },
    help: {
      tr: "Yeni bir kategori açarsınız; ağaçtaki yerini sonra sürükleyerek değiştirirsiniz.",
      en: "Open a new category; move it in the tree afterwards.",
    },
  },
  {
    key: "paymentLinks.new",
    parent: "paymentLinks",
    path: "/payment-links/new",
    label: "paymentLinks.newTitle",
    keywords: {
      tr: ["müşteri adına sipariş", "ödeme linki oluştur", "manuel sipariş"],
      en: ["order for a customer", "create payment link", "manual order"],
    },
    help: {
      tr: "Müşteri adına sipariş oluşturur, ödeme bağlantısını gönderirsiniz.",
      en: "Make an order for a customer and send the payment link.",
    },
  },
  {
    key: "products.dated",
    parent: "products",
    path: "/products",
    feature: "catalog.booking",
    label: "storefront.editor.capabilities.dated",
    keywords: {
      tr: ["tur", "kalkış", "etkinlik", "rezervasyon", "tarihli ürün", "kontenjan", "seans"],
      en: ["tour", "departure", "event", "booking", "dated product", "seats"],
    },
    help: {
      tr: "Tarihle satılan ürünlerin (tur, etkinlik) kalkışları ürünün kendi sayfasındaki Kalkışlar kartındadır. Ürünü açın, kalkış ekleyin ya da iptal edin.",
      en: "A dated product's departures (a tour, an event) are on the product's own page, in its Departures card. Open the product to add or cancel one.",
    },
  },
] satisfies readonly PanelMapEntry[]
