import type { PanelScreen } from "./screens"

/**
 * The screens the assistant knows until the panel's map
 * (`packages/types/src/panel-map`, adr/0079 §4 Y1-0) lands in `dev`: the
 * menu's main items and the settings people ask for most, under the map's
 * own keys, so the switch is a change of import (`screens.ts`
 * `PANEL_SCREENS`) and the panel's links stay as they are.
 */
export const INTERIM_SCREENS: readonly PanelScreen[] = [
  {
    key: "dashboard",
    label: "nav.dashboard",
    keywords: { tr: ["ana sayfa", "özet", "bugün"], en: ["home", "overview", "today"] },
    help: {
      tr: "Günün siparişleri, satışları ve bekleyen işler bir bakışta.",
      en: "Today's orders, sales and the jobs waiting, at a glance.",
    },
  },
  {
    key: "reports",
    label: "nav.reports",
    keywords: {
      tr: ["rapor", "istatistik", "ciro", "satış raporu", "analiz", "grafik"],
      en: ["report", "statistics", "revenue", "sales report", "analytics"],
    },
    help: {
      tr: "Seçtiğiniz dönemin satış özeti ve rapor türleri. Her tablo Excel ya da CSV olarak indirilir.",
      en: "Sales for the period you pick, and the kinds of report. Every table downloads as Excel or CSV.",
    },
  },
  {
    key: "orders",
    label: "nav.orders",
    keywords: {
      tr: ["sipariş", "satış", "kargoya ver", "hazırlanacak", "fatura kes"],
      en: ["order", "sale", "fulfil", "to ship"],
    },
    help: {
      tr: "Gelen siparişleri görür, hazırlar, kargoya verir ve iptal ya da iade edersiniz.",
      en: "See the orders that came in, prepare, ship, cancel or refund them.",
    },
  },
  {
    key: "customers",
    label: "nav.customers",
    keywords: { tr: ["müşteri", "üye", "alıcı"], en: ["customer", "member", "buyer"] },
    help: {
      tr: "Müşterileri, adreslerini ve siparişlerini görürsünüz.",
      en: "See customers, their addresses and their orders.",
    },
  },
  {
    key: "products",
    label: "nav.products",
    keywords: {
      tr: [
        "ürün",
        "mal",
        "stok kodu",
        "fiyat değiştir",
        "ürün görseli",
        "varyant",
        "beden",
        "renk",
      ],
      en: ["product", "item", "sku", "price", "variant", "size", "colour"],
    },
    help: {
      tr: "Ürünleri ekler, fiyatını, görsellerini, varyantlarını ve stoklarını düzenlersiniz.",
      en: "Add products and edit their prices, pictures, variants and stock.",
    },
  },
  {
    key: "inventory",
    label: "nav.inventory",
    keywords: {
      tr: ["stok", "envanter", "depo", "adet", "stok sayımı", "tükenen"],
      en: ["stock", "inventory", "warehouse", "quantity", "out of stock"],
    },
    help: {
      tr: "Ürünlerin depolardaki adetlerini görür ve düzeltirsiniz; azalanlar ayrıca listelenir.",
      en: "See and correct how many of each product the warehouses hold; low stock is listed apart.",
    },
  },
  {
    key: "promotions",
    label: "nav.promotions",
    keywords: {
      tr: ["indirim", "kampanya", "kupon", "indirim kodu", "promosyon", "fırsat"],
      en: ["discount", "promotion", "coupon", "discount code", "sale"],
    },
    help: {
      tr: "İndirim kodları ve kampanyalar oluşturursunuz. Fiyat listeleri ve hediye kartları da buradadır.",
      en: "Create discount codes and promotions. Price lists and gift cards are here too.",
    },
  },
  {
    key: "paymentLinks",
    feature: "orders.payment_links",
    needs: "paymentLinks",
    label: "nav.paymentLinks",
    keywords: {
      tr: ["ödeme linki", "link ile satış", "telefonla sipariş", "whatsapp sipariş"],
      en: ["payment link", "pay by link", "phone order"],
    },
    help: {
      tr: "Müşteri adına sipariş oluşturup ödeme bağlantısını gönderirsiniz; müşteri bağlantıdan öder.",
      en: "Make an order for a customer and send them a link to pay it.",
    },
  },
  {
    key: "settings",
    label: "nav.settings",
    keywords: { tr: ["ayarlar", "ayar"], en: ["settings"] },
    help: { tr: "Mağazanın bütün ayarları.", en: "All of the shop's settings." },
  },
  {
    key: "settings.shipping",
    parent: "settings",
    needs: "settings",
    label: "settings.sections.shipping",
    keywords: {
      tr: ["kargo", "teslimat", "gönderim", "kargo firması", "kargo ayarları"],
      en: ["shipping", "delivery", "carrier", "shipping settings"],
    },
    help: {
      tr: "Kargo firmaları, gönderim seçenekleri ve ücretleri, iade ve depolar.",
      en: "Carriers, delivery options and rates, returns and warehouses.",
    },
  },
  {
    key: "settings.shipping.options",
    parent: "settings.shipping",
    label: "settings.shipping.tabs.options",
    keywords: {
      tr: [
        "kargo ücreti",
        "gönderim bedeli",
        "ücretsiz kargo",
        "kargo bedava",
        "teslimat süresi",
        "desi",
        "kargo fiyatı",
      ],
      en: ["shipping rate", "shipping cost", "free shipping", "delivery time", "parcel size"],
    },
    help: {
      tr: "Müşteriye sunulan gönderim seçenekleri, kargo ücretleri ve ücretsiz kargo sınırı. Teslim süresi ve varsayılan paket ölçüsü de buradadır.",
      en: "The delivery options customers get, shipping rates and the free shipping threshold. Delivery time and the default parcel size are here too.",
    },
  },
  {
    key: "settings.shipping.carriers",
    parent: "settings.shipping",
    label: "settings.shipping.tabs.carriers",
    keywords: {
      tr: ["aras", "yurtiçi", "mng", "sürat", "kargo anlaşması", "kargo etiketi", "barkod"],
      en: ["carrier account", "shipping label", "barcode", "courier"],
    },
    help: {
      tr: "Anlaşmalı kargo firmalarının hesaplarını bağlar, etiket boyutunu seçersiniz.",
      en: "Connect the carriers' accounts and pick the label size.",
    },
  },
  {
    key: "settings.shipping.returns",
    parent: "settings.shipping",
    label: "settings.shipping.tabs.returns",
    keywords: {
      tr: ["iade süresi", "iade kuralları", "iade kargo", "cayma hakkı"],
      en: ["return window", "return rules", "return shipping", "cancellation"],
    },
    help: {
      tr: "İade süresi ve iade kargosunu kimin ödediği.",
      en: "The return window and who pays return shipping.",
    },
  },
  {
    key: "settings.payments",
    parent: "settings",
    needs: "settings",
    label: "settings.sections.payments",
    keywords: {
      tr: ["ödeme yöntemleri", "ödeme ayarları", "tahsilat"],
      en: ["payment methods", "payment settings", "checkout payments"],
    },
    help: {
      tr: "Müşterinin nasıl ödeyeceği: kart sağlayıcıları, taksit, havale/EFT ve kapıda ödeme.",
      en: "How customers pay: card providers, installments, bank transfer and cash on delivery.",
    },
  },
  {
    key: "settings.payments.other",
    parent: "settings.payments",
    label: "settings.payments.groups.other.title",
    keywords: {
      tr: ["havale", "eft", "banka hesabı", "iban", "kapıda ödeme", "kapıda nakit"],
      en: ["bank transfer", "wire", "iban", "bank account", "cash on delivery"],
    },
    help: {
      tr: "Havale/EFT hesap bilgileri ve kapıda ödeme seçenekleri.",
      en: "Bank transfer account details and cash on delivery.",
    },
  },
  {
    key: "settings.einvoice",
    parent: "settings",
    needs: "settings",
    label: "settings.sections.einvoice",
    keywords: {
      tr: ["fatura", "e-fatura", "e-arşiv", "fatura programı", "kdv"],
      en: ["invoice", "e-invoice", "invoicing", "vat"],
    },
    help: {
      tr: "Faturaları kesen program, KDV oranları ve muhasebe ayarları.",
      en: "The program that issues invoices, VAT rates and accounting settings.",
    },
  },
  {
    key: "settings.legal",
    parent: "settings",
    needs: "settings",
    label: "settings.sections.legal",
    keywords: {
      tr: ["kvkk", "aydınlatma metni", "mesafeli satış sözleşmesi", "gizlilik", "yasal metin"],
      en: ["privacy policy", "terms", "legal texts", "distance sales contract"],
    },
    help: {
      tr: "KVKK aydınlatma metni, mesafeli satış sözleşmesi ve diğer yasal metinler.",
      en: "The privacy notice, the distance sales contract and the other legal texts.",
    },
  },
  {
    key: "settings.ai",
    parent: "settings",
    needs: "settings",
    label: "settings.sections.ai",
    keywords: {
      tr: ["yapay zeka", "yapay zekâ", "ai anahtarı", "yazım yönergesi"],
      en: ["ai", "artificial intelligence", "ai key", "writing guidance"],
    },
    help: {
      tr: "Yapay zekâ servislerini bağlar, kullanımını ve yazım yönergesini görürsünüz.",
      en: "Connect AI services and see their use and the writing guidance.",
    },
  },
]
