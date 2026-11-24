import type { PanelMapEntry } from "./types.js"

/** Settings › Sistem: the package, security and team, connections, AI, flags and logs. */
export const SETTINGS_SYSTEM_ENTRIES = [
  {
    key: "settings.subscription",
    parent: "settings",
    path: "/settings/subscription",
    needs: "settings",
    label: "settings.sections.subscription",
    keywords: {
      tr: ["paket", "abonelik", "plan", "limit", "ödeme planı", "fatura geçmişi"],
      en: ["plan", "subscription", "package", "limits", "billing"],
    },
    help: {
      tr: "Mağazanın paketi, kullanım sınırları ve abonelik ödemesi.",
      en: "The shop's plan, usage limits and subscription payment.",
    },
  },
  {
    key: "settings.security",
    parent: "settings",
    path: "/settings/security",
    label: "settings.sections.security",
    keywords: {
      tr: ["şifre", "parola", "iki adımlı doğrulama", "güvenlik", "ekip", "kullanıcı"],
      en: ["password", "two-factor", "security", "team", "users"],
    },
    help: {
      tr: "Kendi hesabınız ve şifreniz, ekip üyeleri ve sahtekârlık önleme kuralları.",
      en: "Your own account and password, the team and the fraud rules.",
    },
  },
  {
    key: "settings.security.account",
    parent: "settings.security",
    path: "/settings/security",
    search: { part: "account" },
    label: "settings.security.tabs.account",
    keywords: {
      tr: ["şifre değiştir", "parola değiştir", "profil", "iki adımlı doğrulama", "oturumlar"],
      en: ["change password", "profile", "two-factor", "2fa", "sessions"],
    },
    help: {
      tr: "Adınız, e-postanız, şifreniz ve iki adımlı doğrulamanız.",
      en: "Your name, e-mail, password and two-step verification.",
    },
  },
  {
    key: "settings.security.team",
    parent: "settings.security",
    path: "/settings/security",
    search: { part: "team" },
    label: "settings.security.tabs.team",
    keywords: {
      tr: ["kullanıcı ekle", "personel", "çalışan", "rol", "yetki", "davet et"],
      en: ["add user", "staff", "employee", "role", "permissions", "invite"],
    },
    help: {
      tr: "Ekip üyelerini davet eder, rollerini ve yetkilerini belirlersiniz.",
      en: "Invite team members and set their roles and permissions.",
    },
  },
  {
    key: "settings.security.fraud",
    parent: "settings.security",
    path: "/settings/security",
    search: { part: "fraud" },
    label: "settings.security.tabs.fraud",
    keywords: {
      tr: ["dolandırıcılık", "şüpheli sipariş kuralı", "engelli müşteri", "kara liste"],
      en: ["fraud rules", "block list", "blocked customer"],
    },
    help: {
      tr: "Hangi siparişin incelemeye alınacağı ve mağazanın geri çevirdiği kişiler.",
      en: "Which orders are held for review and who the shop turns away.",
    },
  },
  {
    key: "settings.integrations",
    parent: "settings",
    path: "/settings/integrations",
    needs: "settings",
    label: "settings.sections.integrations",
    keywords: {
      tr: ["entegrasyon", "bağlantı", "pazaryeri", "google", "search console", "uygulama"],
      en: ["integration", "connection", "marketplace", "google", "apps"],
    },
    help: {
      tr: "Mağazanın bağlandığı dış servisler ve durumları.",
      en: "The outside services the shop connects to, and their state.",
    },
  },
  {
    key: "settings.ai",
    parent: "settings",
    path: "/settings/ai",
    needs: "settings",
    label: "settings.sections.ai",
    keywords: {
      tr: ["yapay zeka", "chatgpt", "openai", "gemini", "claude", "otomatik açıklama"],
      en: ["ai", "artificial intelligence", "chatgpt", "openai", "gemini", "claude"],
    },
    help: {
      tr: "Yapay zekâ servislerini bağlar, kullanımını ve yazım yönergesini düzenlersiniz.",
      en: "Connect AI services and manage their use and the writing guide.",
    },
  },
  {
    key: "settings.ai.services",
    parent: "settings.ai",
    path: "/settings/ai",
    search: { part: "services" },
    label: "ai.tabs.services",
    keywords: {
      tr: ["api anahtarı", "yapay zeka bağla", "kullanım", "maliyet"],
      en: ["api key", "connect ai", "usage", "cost"],
    },
    help: {
      tr: "Bağlı yapay zekâ servisleri, sınamaları ve kullanım özeti.",
      en: "The connected AI services, their tests and a usage summary.",
    },
  },
  {
    key: "settings.ai.writing",
    parent: "settings.ai",
    path: "/settings/ai",
    search: { part: "writing" },
    label: "ai.tabs.writing",
    keywords: {
      tr: ["marka dili", "yazım tonu", "üslup", "yönerge"],
      en: ["brand voice", "tone", "style guide"],
    },
    help: {
      tr: "Yapay zekânın yazarken uyacağı marka dili ve kurallar.",
      en: "The brand voice and rules AI follows when it writes.",
    },
  },
  {
    key: "settings.api",
    parent: "settings",
    path: "/settings/api",
    needs: "keys",
    label: "settings.sections.api",
    keywords: {
      tr: ["api anahtarı", "token", "geliştirici", "webhook"],
      en: ["api key", "token", "developer", "webhook"],
    },
    help: {
      tr: "Dış yazılımların mağazaya bağlanması için API anahtarları.",
      en: "API keys for outside software to connect to the shop.",
    },
  },
  {
    key: "settings.features",
    parent: "settings",
    path: "/settings/features",
    needs: "settings",
    label: "settings.sections.features",
    keywords: {
      tr: ["özellik aç", "özellik kapat", "modül", "hediye kartı aç", "toptan satış aç"],
      en: ["turn on feature", "feature flags", "modules"],
    },
    help: {
      tr: "Mağazada kullanılan özellikleri (koleksiyon, hediye kartı, toptan satış, tarihli ürün) açıp kapatırsınız.",
      en: "Turn the shop's features on or off (collections, gift cards, wholesale, dated products).",
    },
  },
  {
    key: "settings.migration",
    parent: "settings",
    path: "/settings/migration",
    needs: "migration",
    label: "settings.sections.migration",
    keywords: {
      tr: ["taşı", "içe aktar", "shopify", "ikas", "ticimax", "eski site"],
      en: ["import", "migrate", "shopify", "old site"],
    },
    help: {
      tr: "Mağazayı eski platformundan ürünleri, müşterileri ve adresleriyle taşırsınız.",
      en: "Move the shop in from its old platform with its products, customers and addresses.",
    },
  },
  {
    key: "settings.audit",
    parent: "settings",
    path: "/settings/audit",
    needs: "audit",
    label: "settings.sections.audit",
    keywords: {
      tr: ["kim değiştirdi", "işlem geçmişi", "kayıt", "log"],
      en: ["who changed", "activity log", "history", "log"],
    },
    help: {
      tr: "Panelde kimin neyi ne zaman değiştirdiği ve arka planda çalışan işler.",
      en: "Who changed what and when in the panel, and the jobs running in the background.",
    },
  },
  {
    key: "settings.audit.jobs",
    parent: "settings.audit",
    path: "/settings/audit",
    search: { part: "jobs" },
    label: "settings.jobs.title",
    keywords: {
      tr: ["arka plan işi", "içe aktarma durumu", "dışa aktarma", "toplu işlem"],
      en: ["background job", "import status", "export", "bulk job"],
    },
    help: {
      tr: "İçe ve dışa aktarma gibi uzun süren işlerin durumu.",
      en: "The state of long jobs such as imports and exports.",
    },
  },
] satisfies readonly PanelMapEntry[]
