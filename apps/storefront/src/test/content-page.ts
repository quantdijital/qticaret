import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  ContactView,
  ContentPageView,
  ImageView,
  PageArticleView,
  PageContactView,
  PagePaymentFactsView,
  PageShippingFactsView,
} from "@qticaret/ui"
import { renderPage } from "./theme-render"

/**
 * The theme's content pages as their specs draw them: a page's view, its
 * text sections (adr/0073 Ek 2026-11-19 (2) K2) and the shop's details
 * they show, rendered through Atölye's `ContentPage`.
 */

export const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 1280,
  height: 800,
  sources: { avif: null, webp: `/media/${name}-640.webp 640w` },
})

export const contact: ContactView = {
  email: "bilgi@example.com",
  phone: "0532 000 00 00",
  phoneHref: "tel:+905320000000",
  whatsappHref: "https://wa.me/905320000000",
  address: "Örnek Mah. 1. Sok. No: 1, Denizli",
  hours: [{ days: "Pazartesi – Cuma", hours: "08:00 – 19:00" }],
  mapHref: "https://maps.example.com/atolye",
}

const view = (over: Partial<ContentPageView> = {}): ContentPageView => ({
  title: "Hakkımızda",
  breadcrumbs: [
    { label: "Ana sayfa", path: "/" },
    { label: "Hakkımızda", path: null },
  ],
  html: "<p>Atölye mağazası.</p>",
  publishedAt: null,
  ...over,
})

/** The page as the theme draws it, the contact form's action given. */
export const page = (over: Partial<ContentPageView> = {}) =>
  renderPage(atolyeTheme, "ContentPage", {
    view: view(over),
    actions: { sendContact: () => Promise.resolve({ ok: true, error: null, challenge: null }) },
  })

export const outline = [
  { id: "bir", label: "Bir" },
  { id: "iki", label: "İki" },
  { id: "uc", label: "Üç" },
]

/** The page's text as a section. */
export const article = (over: Partial<PageArticleView> = {}): PageArticleView => ({
  id: "metin",
  type: "rich_text",
  variant: "article",
  title: null,
  html: "<p>Atölye mağazası.</p>",
  outline: [],
  faq: null,
  help: null,
  ...over,
})

/** A page of its text alone, as `sections`. */
export const textPage = (
  over: Partial<PageArticleView> = {},
  rest: Partial<ContentPageView> = {}
) => page({ sections: [article(over)], ...rest })

export const payments: PagePaymentFactsView = {
  id: "odeme",
  type: "payment_facts",
  payments: {
    marks: [
      { key: "visa", label: "Visa", logo: { src: "/marks/visa.png", width: 208, height: 68 } },
      { key: "bank_transfer", label: "Havale / EFT", logo: null },
    ],
    installments: [
      { family: "World", options: [{ count: 2, rate: "Vade farksız", free: true }] },
      {
        family: "Bonus",
        options: [
          { count: 2, rate: "%4,35", free: false },
          { count: 3, rate: "%5,79", free: false },
        ],
      },
    ],
    maxInstallments: 3,
  },
}

export const shipping: PageShippingFactsView = {
  id: "kargo",
  type: "shipping_facts",
  shipping: {
    carriers: [{ key: "aras", label: "Aras Kargo", logo: null }],
    promises: [{ icon: "truck", title: "Ücretsiz kargo", text: "1.500 TL ve üzeri" }],
  },
}

/** The contact page's body as a section, its form and imprint on. */
export const contactSection = (over: Partial<PageContactView> = {}): PageContactView => ({
  id: "iletisim",
  type: "contact",
  html: "<p>Bize yazın.</p>",
  contact,
  identity: [
    { label: "Unvan", value: "Örnek Atölye Ltd. Şti." },
    { label: "MERSİS numarası", value: "0123456789000015" },
  ],
  form: {
    subjects: [{ value: "order", label: "Siparişim" }],
    name: null,
    email: null,
    privacyPath: "/yasal/kvkk-aydinlatma-metni",
  },
  ...over,
})
