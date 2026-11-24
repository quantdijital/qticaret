import type { PanelMapEntry } from "./types"

/** Settings › Satış ve teslimat: payments, invoices and shipping, each with its tabs. */
export const SETTINGS_SELLING_ENTRIES = [
  {
    key: "settings.payments",
    parent: "settings",
    path: "/settings/payments",
    needs: "settings",
    label: "settings.sections.payments",
    keywords: {
      // Its tabs carry the particular words (havale, sanal pos), so a tab comes first for them
      tr: ["ödeme yöntemleri", "ödeme ayarları", "tahsilat"],
      en: ["payment methods", "payment settings", "checkout payments"],
    },
    help: {
      tr: "Müşterinin nasıl ödeyeceği: kart sağlayıcıları, taksit, havale/EFT ve kapıda ödeme.",
      en: "How customers pay: card providers, installments, bank transfer and cash on delivery.",
    },
  },
  {
    key: "settings.payments.card",
    parent: "settings.payments",
    path: "/settings/payments",
    search: { part: "card" },
    label: "settings.payments.groups.card.title",
    keywords: {
      tr: ["sanal pos", "ödeme sağlayıcısı", "paytr", "iyzico", "kart ile ödeme", "3d secure"],
      en: ["payment provider", "card processor", "paytr", "iyzico", "card payments"],
    },
    help: {
      tr: "Kart ödemesi alan sağlayıcıyı (PayTR, iyzico) bağlar ve tercih edilenini seçersiniz.",
      en: "Connect the provider that takes card payments (PayTR, iyzico) and pick the preferred one.",
    },
  },
  {
    key: "settings.payments.installments",
    parent: "settings.payments",
    path: "/settings/payments",
    search: { part: "installments" },
    label: "settings.payments.tabs.installments",
    keywords: {
      tr: ["taksit", "vade farkı", "taksit seçenekleri", "peşin fiyatına taksit"],
      en: ["installments", "instalment plan", "interest"],
    },
    help: {
      tr: "Kart ödemelerinde sunulan taksit sayıları ve vade farkları.",
      en: "The installment counts and their interest offered on card payments.",
    },
  },
  {
    key: "settings.payments.other",
    parent: "settings.payments",
    path: "/settings/payments",
    search: { part: "other" },
    label: "settings.payments.groups.other.title",
    keywords: {
      tr: ["havale", "eft", "banka hesabı", "iban", "kapıda ödeme", "kapıda nakit"],
      en: ["bank transfer", "wire", "iban", "bank account", "cash on delivery"],
    },
    help: {
      tr: "Havale/EFT için banka hesabı ve IBAN bilgisi, kapıda ödeme ve diğer yöntemler.",
      en: "The bank account and IBAN for transfers, cash on delivery and other methods.",
    },
  },
  {
    key: "settings.payments.links",
    parent: "settings.payments",
    path: "/settings/payments",
    search: { part: "payment-links" },
    label: "settings.payments.tabs.paymentLinks",
    keywords: {
      tr: ["ödeme linki ayarı", "link indirimi", "bağlantı süresi"],
      en: ["payment link settings", "link discount", "link expiry"],
    },
    help: {
      tr: "Ödeme bağlantılarıyla verilen siparişlerde indirim sınırı ve kapıda ödeme.",
      en: "The discount limit and cash on delivery for orders paid by link.",
    },
  },
  {
    key: "settings.einvoice",
    parent: "settings",
    path: "/settings/einvoice",
    needs: "settings",
    label: "settings.sections.einvoice",
    keywords: {
      tr: ["fatura", "e-fatura", "e-arşiv", "muhasebe", "fatura programı"],
      en: ["invoice", "e-invoice", "accounting", "invoicing software"],
    },
    help: {
      tr: "Faturaların hangi programla kesileceği, KDV oranları ve muhasebe aktarımı.",
      en: "Which program issues the invoices, the VAT rates and the accounting export.",
    },
  },
  {
    key: "settings.einvoice.program",
    parent: "settings.einvoice",
    path: "/settings/einvoice",
    search: { part: "program" },
    label: "settings.einvoice.tabs.program",
    keywords: {
      tr: ["fatura sağlayıcısı", "e-fatura entegratörü", "paraşüt", "otomatik fatura"],
      en: ["invoicing provider", "e-invoice provider", "parasut", "automatic invoice"],
    },
    help: {
      tr: "Faturaları kesen programı (e-fatura entegratörü) bağlar, otomatik fatura kesimini açarsınız.",
      en: "Connect the program that issues invoices and turn on automatic invoicing.",
    },
  },
  {
    key: "settings.einvoice.carriers",
    parent: "settings.einvoice",
    path: "/settings/einvoice",
    search: { part: "carriers" },
    label: "settings.einvoice.tabs.carriers",
    keywords: {
      tr: ["irsaliye", "taşıyıcı vkn", "kargo vergi no"],
      en: ["waybill", "carrier tax id"],
    },
    help: {
      tr: "E-faturada ve irsaliyede yazılan kargo firmalarının vergi bilgileri.",
      en: "The carriers' tax details written on e-invoices and waybills.",
    },
  },
  {
    key: "settings.einvoice.vat",
    parent: "settings.einvoice",
    path: "/settings/einvoice",
    search: { part: "vat" },
    label: "settings.einvoice.tabs.vat",
    keywords: {
      tr: ["kdv", "vergi", "vergi oranı", "kdv dahil", "yüzde 20"],
      en: ["vat", "tax", "tax rate", "tax included"],
    },
    help: {
      tr: "Ürünlere uygulanan KDV oranları ve varsayılan oran.",
      en: "The VAT rates applied to products, and the default one.",
    },
  },
  {
    key: "settings.einvoice.accounting",
    parent: "settings.einvoice",
    path: "/settings/einvoice",
    search: { part: "accounting" },
    label: "settings.einvoice.tabs.accounting",
    keywords: {
      tr: ["muhasebeci", "muhasebe programı", "logo", "mikro", "aktarım"],
      en: ["accountant", "accounting software", "export"],
    },
    help: {
      tr: "Satışların muhasebe programına ya da muhasebeciye aktarımı.",
      en: "Sending the sales to the accounting software or the accountant.",
    },
  },
  {
    key: "settings.shipping",
    parent: "settings",
    path: "/settings/shipping",
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
    key: "settings.shipping.carriers",
    parent: "settings.shipping",
    path: "/settings/shipping",
    search: { part: "carriers" },
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
    key: "settings.shipping.options",
    parent: "settings.shipping",
    path: "/settings/shipping",
    search: { part: "options" },
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
    key: "settings.shipping.returns",
    parent: "settings.shipping",
    path: "/settings/shipping",
    search: { part: "returns" },
    label: "settings.shipping.tabs.returns",
    keywords: {
      tr: ["iade süresi", "iade kuralları", "iade kargo", "cayma hakkı", "rezervasyon iptali"],
      en: ["return window", "return rules", "return shipping", "cancellation"],
    },
    help: {
      tr: "İade süresi, iade kargosunu kimin ödediği ve tarihli ürünlerin iptal akışı.",
      en: "The return window, who pays return shipping and dated products' cancellation flow.",
    },
  },
  {
    key: "settings.shipping.locations",
    parent: "settings.shipping",
    path: "/settings/shipping",
    search: { part: "locations" },
    label: "settings.shipping.tabs.locations",
    keywords: {
      tr: ["depo", "mağaza adresi", "çıkış adresi", "stok yeri"],
      en: ["warehouse", "location", "ship from"],
    },
    help: {
      tr: "Ürünlerin tutulduğu ve gönderildiği depolar.",
      en: "The warehouses products are kept in and shipped from.",
    },
  },
] satisfies readonly PanelMapEntry[]
