import type { PanelMapEntry } from "./types.js"

/** Settings › Mağaza: the shop's profile, look, product attributes and legal texts. */
export const SETTINGS_SHOP_ENTRIES = [
  {
    key: "settings.store",
    parent: "settings",
    path: "/settings/store",
    needs: "settings",
    label: "settings.sections.store",
    keywords: {
      tr: ["mağaza adı", "mağaza bilgileri", "firma bilgileri", "logo", "para birimi"],
      en: ["store name", "store details", "company details", "logo", "currency"],
    },
    help: {
      tr: "Mağazanın adı, logosu, iletişim bilgileri, yasal kimliği ve sosyal hesapları.",
      en: "The shop's name, logo, contact details, legal identity and social accounts.",
    },
  },
  {
    key: "settings.store.general",
    parent: "settings.store",
    path: "/settings/store",
    search: { part: "general" },
    label: "settings.store.tabs.general",
    keywords: {
      tr: ["mağaza adı", "logo", "bölge", "para birimi", "çalışma saatleri"],
      en: ["store name", "logo", "region", "currency", "opening hours"],
    },
    help: {
      tr: "Mağazanın adı, logosu, bölgesi ve çalışma saatleri.",
      en: "The shop's name, logo, region and opening hours.",
    },
  },
  {
    key: "settings.store.contact",
    parent: "settings.store",
    path: "/settings/store",
    search: { part: "contact" },
    label: "settings.store.tabs.contact",
    keywords: {
      tr: ["telefon", "adres", "iletişim e-postası", "whatsapp numarası"],
      en: ["phone", "address", "contact email", "whatsapp number"],
    },
    help: {
      tr: "Vitrinde ve e-postalarda görünen telefon, adres ve e-posta.",
      en: "The phone, address and e-mail shown on the storefront and in e-mails.",
    },
  },
  {
    key: "settings.store.legal",
    parent: "settings.store",
    path: "/settings/store",
    search: { part: "legal" },
    label: "settings.store.tabs.legal",
    keywords: {
      tr: ["vergi numarası", "vergi dairesi", "mersis", "unvan", "etbis", "ticari bilgiler"],
      en: ["tax number", "tax office", "legal name", "company registration"],
    },
    help: {
      tr: "Şirket unvanı, vergi bilgileri, MERSİS ve ETBİS karekodu; faturalarda ve sözleşmelerde kullanılır.",
      en: "The company's legal name, tax details and registration; used on invoices and contracts.",
    },
  },
  {
    key: "settings.store.social",
    parent: "settings.store",
    path: "/settings/store",
    search: { part: "social" },
    label: "settings.store.tabs.social",
    keywords: {
      tr: ["instagram", "facebook", "sosyal medya", "youtube", "tiktok"],
      en: ["instagram", "facebook", "social media", "youtube", "tiktok"],
    },
    help: {
      tr: "Vitrinde bağlantısı verilen sosyal medya hesapları.",
      en: "The social media accounts the storefront links to.",
    },
  },
  {
    key: "settings.maintenance",
    parent: "settings",
    path: "/settings/maintenance",
    label: "settings.sections.maintenance",
    keywords: {
      tr: ["siteyi kapat", "bakımda", "yakında açılıyor", "vitrini gizle"],
      en: ["close the shop", "maintenance mode", "coming soon", "hide storefront"],
    },
    help: {
      tr: "Vitrini geçici olarak kapatır, ziyaretçilere bakım sayfası gösterirsiniz.",
      en: "Close the storefront for a while and show visitors a maintenance page.",
    },
  },
  {
    key: "settings.appearance",
    parent: "settings",
    path: "/settings/appearance",
    needs: "settings",
    label: "settings.sections.appearance",
    keywords: {
      tr: ["panel görünümü", "karanlık mod", "panel rengi", "görünüm ayarları"],
      en: ["panel look", "dark mode", "panel colour", "appearance"],
    },
    help: {
      tr: "Yönetim panelinin rengi ve açık ya da koyu görünümü.",
      en: "The admin panel's colour and its light or dark look.",
    },
  },
  {
    key: "settings.attributes",
    parent: "settings",
    path: "/settings/attributes",
    needs: "settings",
    label: "settings.sections.attributes",
    keywords: {
      tr: ["ürün özelliği", "nitelik", "filtre", "malzeme", "ek seçenek", "kişiselleştirme"],
      en: ["product attribute", "filter", "material", "add-on", "personalisation"],
    },
    help: {
      tr: "Ürünlere eklenen özellikleri (malzeme, uzunluk) ve vitrin filtrelerini tanımlarsınız.",
      en: "Define the attributes products carry (material, length) and the storefront's filters.",
    },
  },
  {
    key: "settings.legal",
    parent: "settings",
    path: "/settings/legal",
    needs: "settings",
    label: "settings.sections.legal",
    keywords: {
      tr: [
        "kvkk",
        "aydınlatma metni",
        "gizlilik politikası",
        "mesafeli satış sözleşmesi",
        "iade politikası",
        "çerez politikası",
        "sözleşme",
      ],
      en: ["privacy policy", "terms", "distance sales contract", "return policy", "cookie policy"],
    },
    help: {
      tr: "KVKK aydınlatma metni, gizlilik, mesafeli satış ve iade metinleri. Taslağı yazar, önizler ve yayımlarsınız.",
      en: "The privacy notice, distance sales contract and return policy. Write a draft, preview and publish it.",
    },
  },
] satisfies readonly PanelMapEntry[]
