import { createElement } from "react"
import type { ComponentType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { HeaderCatalogView, ShopView, StorefrontTheme } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { DEFAULT_THEME, themeView } from "@/lib/views/theme"

/**
 * A theme's page as the server prints it, for any theme package
 * (adr/0057): `renderPage(atolyeTheme, "HomePage", { view })`. The words
 * are the storefront's own `t`.
 */
export function renderPage<Name extends keyof StorefrontTheme>(
  theme: StorefrontTheme,
  name: Name,
  props: Omit<NonNullable<StorefrontTheme[Name]> extends ComponentType<infer P> ? P : never, "t">
): string {
  const Page = theme[name] as ComponentType<Record<string, unknown>> | undefined
  if (!Page) {
    throw new Error(`The theme draws no ${name}`)
  }
  return renderToStaticMarkup(createElement(Page, { ...props, t }))
}

/** A theme's frame around a line of text, under the shop given. */
export const renderFrame = (theme: StorefrontTheme, shop: ShopView): string =>
  renderPage(theme, "Layout", {
    shop,
    children: createElement("p", null, "Sayfa"),
    saveCookies: () => Promise.resolve(),
  })

/** A shop with a bit of everything the frame draws; tests override what they look at. */
export const shopFixture = (over: Partial<ShopView> = {}): ShopView => ({
  name: "Örnek Atölye",
  logo: null,
  categories: [
    {
      label: "Çakılar",
      path: "/kategori/cakilar",
      children: [
        { label: "Katlanır çakılar", path: "/kategori/cakilar/katlanir" },
        { label: "Sabit çakılar", path: "/kategori/cakilar/sabit" },
      ],
    },
    { label: "Aksesuar", path: "/kategori/aksesuar", children: [] },
  ],
  cartQuantity: 2,
  cart: null,
  announcements: [],
  // The dark top strip with every part on: what a design from before the separate strip draws
  topStrip: { variant: "graphite", links: true, phone: true, account: false },
  newsletter: null,
  topLinks: [{ label: "Hakkımızda", path: "/hakkimizda" }],
  footerGroups: [{ title: "Yardım", links: [{ label: "İletişim", path: "/iletisim" }] }],
  trustBadges: [{ icon: "truck", title: "Ücretsiz kargo", text: "1.500,00 TL ve üzeri" }],
  contact: {
    email: "bilgi@example.com",
    phone: "0532 000 00 00",
    phoneHref: "tel:+905320000000",
    whatsappHref: "https://wa.me/905320000000",
    address: "Örnek Mah. 1. Sok. No: 1, Denizli",
    hours: [{ days: "Pazartesi – Cuma", hours: "09:00 – 18:00" }],
    mapHref: null,
  },
  social: [{ label: "Instagram", href: "https://www.instagram.com/ornek" }],
  companyTitle: "Örnek Atölye Ltd. Şti.",
  cookieBanner: null,
  customerName: null,
  legalLinks: [{ label: "Mesafeli Satış Sözleşmesi", path: "/yasal/mesafeli-satis-sozlesmesi" }],
  privacyPath: null,
  identityLines: ["MERSİS: 0000000000000000", "Denizli V.D. 0000000000"],
  // The defaults, Grafit (adr/0062 §2)
  theme: themeView(DEFAULT_THEME),
  bottomNav: { current: "home" },
  ...over,
})

/**
 * The top strip a catalog header's old settings read into (owner's
 * decision 2026-11-27; the backend's `withSeparateTopStrip`): its own strip
 * on, the light strip with its note, the links unless on the menu bar and
 * "Hesabım" while the tools stand on it; off, the dark bar with what the
 * header left it (the links, the phone), else none. The catalog specs draw
 * the header with it, so each reads as the design it was saved as.
 */
export function catalogStrip(catalog: HeaderCatalogView): ShopOver {
  const links = catalog.topLinksPlace !== "bar"
  if (catalog.utilityBar) {
    const note = catalog.stripNote ?? null
    return {
      topStrip: {
        variant: "light",
        links,
        phone: true,
        account: catalog.accountText && catalog.toolsPlace !== "row",
      },
      announcements: note ? [note.text] : [],
      ...(note?.path ? { announcementLink: { label: note.text, path: note.path } } : {}),
    }
  }
  return links || !catalog.phone
    ? {
        topStrip: { variant: "graphite", links, phone: !catalog.phone, account: false },
        announcements: [],
      }
    : { noStrip: true }
}

/** A shop's fields over the fixture's; `noStrip`: no top strip section at all. */
export type ShopOver = Partial<ShopView> & { noStrip?: true }

/** The fixture shop with `over`, its top strip left out when `noStrip`. */
export function shopOf({ noStrip, ...over }: ShopOver): ShopView {
  const shop = shopFixture(over)
  if (noStrip) {
    delete shop.topStrip
  }
  return shop
}
