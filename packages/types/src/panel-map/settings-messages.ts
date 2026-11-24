import type { PanelMapEntry } from "./types"

/** Settings › İletişim ve pazarlama: e-mail and SMS, and the marketing settings. */
export const SETTINGS_MESSAGES_ENTRIES = [
  {
    key: "settings.notifications",
    parent: "settings",
    path: "/settings/notifications",
    needs: "settings",
    label: "settings.sections.notifications",
    keywords: {
      tr: ["e-posta ayarı", "sms ayarı", "bildirim e-postası", "mail"],
      en: ["email settings", "sms settings", "notification email", "mail"],
    },
    help: {
      tr: "Müşterilere ve size giden e-postalar ile SMS'ler: gönderen adres, şablonlar ve uyarılar.",
      en: "The e-mails and SMS sent to customers and to you: sender, templates and alerts.",
    },
  },
  {
    key: "settings.notifications.email",
    parent: "settings.notifications",
    path: "/settings/notifications",
    search: { part: "email" },
    label: "settings.notifications.tabs.email",
    keywords: {
      tr: ["gönderen adres", "smtp", "e-posta alan adı", "dns kaydı", "e-posta limiti"],
      en: ["sender address", "smtp", "email domain", "dns records", "email limit"],
    },
    help: {
      tr: "E-postaların hangi adresten ve alan adından gideceği, SMTP ve gönderim sınırı.",
      en: "Which address and domain e-mails go from, SMTP and the sending limit.",
    },
  },
  {
    key: "settings.notifications.sms",
    parent: "settings.notifications",
    path: "/settings/notifications",
    search: { part: "sms" },
    label: "settings.notifications.tabs.sms",
    keywords: {
      tr: ["sms sağlayıcısı", "netgsm", "sms başlığı", "kısa mesaj"],
      en: ["sms provider", "sms sender id", "text message"],
    },
    help: {
      tr: "SMS sağlayıcısını bağlar ve hangi durumlarda SMS gideceğini seçersiniz.",
      en: "Connect the SMS provider and pick when an SMS is sent.",
    },
  },
  {
    key: "settings.notifications.templates",
    parent: "settings.notifications",
    path: "/settings/notifications",
    search: { part: "templates" },
    label: "settings.notifications.tabs.templates",
    keywords: {
      tr: ["e-posta şablonu", "sipariş e-postası", "kargo bildirimi", "mesaj metni"],
      en: ["email template", "order email", "shipping notification", "message text"],
    },
    help: {
      tr: "Müşteriye giden sipariş, kargo ve iade e-postalarının metinleri ve önizlemesi.",
      en: "The texts of the order, shipping and return e-mails customers get, with a preview.",
    },
  },
  {
    key: "settings.notifications.staff",
    parent: "settings.notifications",
    path: "/settings/notifications",
    search: { part: "staff" },
    label: "settings.notifications.tabs.staff",
    keywords: {
      tr: ["yeni sipariş bildirimi", "personel uyarısı", "bana haber ver"],
      en: ["new order alert", "staff alert", "notify me"],
    },
    help: {
      tr: "Yeni sipariş, iade ya da stok azalınca ekibinize giden uyarılar.",
      en: "The alerts your team gets on a new order, a return or low stock.",
    },
  },
  {
    key: "settings.marketing",
    parent: "settings",
    path: "/settings/marketing",
    needs: "settings",
    label: "settings.sections.marketing",
    keywords: {
      tr: ["pazarlama ayarı", "reklam", "google alışveriş", "piksel"],
      en: ["marketing settings", "ads", "google shopping", "pixel"],
    },
    help: {
      tr: "Ürün akışları, dönüşüm ölçümü, terk edilen sepet hatırlatması ve toplu mesaj ayarları.",
      en: "Product feeds, conversion tracking, abandoned cart reminders and bulk message settings.",
    },
  },
  {
    key: "settings.marketing.feeds",
    parent: "settings.marketing",
    path: "/settings/marketing",
    search: { part: "feeds" },
    label: "settings.marketing.tabs.feeds",
    keywords: {
      tr: ["ürün akışı", "google merchant", "xml", "akakçe", "cimri", "katalog akışı"],
      en: ["product feed", "google merchant", "xml feed", "catalog feed"],
    },
    help: {
      tr: "Google Merchant ve fiyat karşılaştırma siteleri için ürün akışları.",
      en: "Product feeds for Google Merchant and price comparison sites.",
    },
  },
  {
    key: "settings.marketing.conversions",
    parent: "settings.marketing",
    path: "/settings/marketing",
    search: { part: "conversions" },
    label: "settings.marketing.tabs.conversions",
    keywords: {
      tr: ["meta piksel", "facebook piksel", "google analytics", "google ads", "dönüşüm kodu"],
      en: ["meta pixel", "facebook pixel", "google analytics", "google ads", "conversion tracking"],
    },
    help: {
      tr: "Reklam ve analiz araçlarının (Meta piksel, Google Analytics) satışları ölçmesi.",
      en: "Letting ad and analytics tools (Meta pixel, Google Analytics) measure sales.",
    },
  },
  {
    key: "settings.marketing.carts",
    parent: "settings.marketing",
    path: "/settings/marketing",
    search: { part: "carts" },
    label: "settings.marketing.tabs.carts",
    keywords: {
      tr: ["sepet hatırlatma", "terk edilen sepet e-postası", "sepet indirimi"],
      en: ["cart reminder", "abandoned cart email", "cart discount"],
    },
    help: {
      tr: "Sepetini bırakan müşteriye hatırlatmanın ne zaman ve hangi indirimle gideceği.",
      en: "When a reminder goes to a customer who left their cart, and with what discount.",
    },
  },
  {
    key: "settings.marketing.bulk",
    parent: "settings.marketing",
    path: "/settings/marketing",
    search: { part: "bulk" },
    label: "settings.marketing.tabs.bulk",
    keywords: {
      tr: ["izinli liste", "ileti izni", "iys", "abonelikten çık"],
      en: ["opt-in list", "consent", "unsubscribe"],
    },
    help: {
      tr: "Toplu e-posta ve SMS için gönderen bilgileri, izin ve abonelikten çıkış.",
      en: "Sender details, consent and unsubscribing for bulk e-mail and SMS.",
    },
  },
] satisfies readonly PanelMapEntry[]
