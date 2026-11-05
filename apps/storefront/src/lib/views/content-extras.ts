import type { LegalIdentity, StorefrontFrame } from "@qticaret/types"
import type {
  IdentityRowView,
  InstallmentRatesView,
  PostMetaView,
  SocialLinkView,
  Translate,
} from "@qticaret/ui"

/**
 * The content pages' extras in words (adr/0046 Ek 2026-11-05, içerik
 * sayfaları): a post's facts, its share links, the shop's imprint, the
 * card families' installment rates. Pure: the screen fetches, these shape.
 */

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

/** A post's date, reading time and author, as its page says them. */
export function postMeta(
  entry: { published_at: string | null; reading_minutes: number; author_name: string | null },
  t: Translate
): PostMetaView {
  return {
    date: entry.published_at ? DATE.format(new Date(entry.published_at)) : null,
    dateTime: entry.published_at,
    reading: t("blog.reading", { minutes: entry.reading_minutes }),
    author: entry.author_name?.trim() ? entry.author_name.trim() : null,
  }
}

/**
 * The networks' own share addresses for a page: nothing of the reader's
 * goes with them, only the page's address and title. None without the
 * page's canonical address (a shop not yet on its domain).
 */
export function shareLinks(url: string | null, title: string, t: Translate): SocialLinkView[] {
  if (!url) {
    return []
  }
  const page = encodeURIComponent(url)
  const words = encodeURIComponent(title)
  return [
    { label: "WhatsApp", href: `https://wa.me/?text=${words}%20${page}` },
    { label: "X", href: `https://x.com/intent/post?url=${page}&text=${words}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${page}` },
    { label: t("blog.share_email"), href: `mailto:?subject=${words}&body=${page}` },
  ]
}

/** The ids of the products a text's product cards name (adr/0019: `data-product-id`), in order, once each. */
export function cardProductIds(html: string): string[] {
  const ids = [...html.matchAll(/data-product-id="([^"]+)"/g)].flatMap((match) =>
    match[1] ? [match[1]] : []
  )
  return [...new Set(ids)]
}

/**
 * The shop's imprint (künye) for its contact page: the registered title,
 * address and numbers the e-commerce law asks a shop to show, those it
 * filled in, each on its own line.
 */
export function identityRows(identity: LegalIdentity, t: Translate): IdentityRowView[] {
  const rows: [string, string | null][] = [
    ["content.identity_title", identity.company_title],
    ["content.identity_address", identity.address],
    ["content.identity_mersis", identity.mersis],
    [
      "content.identity_tax",
      identity.tax_office && identity.tax_number
        ? `${identity.tax_office} / ${identity.tax_number}`
        : null,
    ],
    ["content.identity_kep", identity.kep],
    ["content.identity_etbis", identity.etbis],
  ]
  return rows.flatMap(([key, value]) => (value?.trim() ? [{ label: t(key), value }] : []))
}

/** How a card family is written on its own cards; an unknown one as the provider names it. */
const FAMILIES: Record<string, string> = {
  advantage: "Advantage",
  axess: "Axess",
  bankkart: "Bankkart",
  bonus: "Bonus",
  cardfinans: "CardFinans",
  combo: "Combo",
  maximum: "Maximum",
  paraf: "Paraf",
  saglamkart: "Sağlam Kart",
  world: "World",
}

export const familyName = (family: string): string => FAMILIES[family.toLowerCase()] ?? family

const PERCENT = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * The card families' installment rates from the provider's table: the
 * one-payment row left out, each surcharge as "%3,49", none as its words.
 * The amounts in the table were for one example and are not shown.
 */
export function installmentRates(
  families: readonly { family: string; options: readonly { count: number; rate: number }[] }[],
  t: Translate
): InstallmentRatesView[] {
  return families.flatMap((family) => {
    const options = family.options
      .filter((option) => option.count >= 2)
      .map((option) => ({
        count: option.count,
        free: option.rate <= 0,
        rate:
          option.rate <= 0
            ? t("content.rate_free")
            : t("content.rate", { rate: PERCENT.format(option.rate) }),
      }))
    return options.length > 0 ? [{ family: familyName(family.family), options }] : []
  })
}

/** What a backend without the two settings meant: the addresses Turkish shops give these pages. */
const DEFAULT_INFO_PAGES = {
  payment_info_path: "/odeme-secenekleri",
  shipping_info_path: "/kargo-ve-teslimat",
} as const

/**
 * Whether a page is the shop's payment or shipping page: the pages the
 * shop chose in its storefront settings, as it chooses its contact page
 * (`payment_info_path`, `shipping_info_path`; adr/0046 Ek 2026-11-05). A
 * setting saved as none names no page.
 */
export function infoPageOf(
  path: string,
  frame: Pick<StorefrontFrame, "payment_info_path" | "shipping_info_path">
): "payments" | "shipping" | null {
  const payments =
    frame.payment_info_path ??
    (frame.payment_info_path === undefined ? DEFAULT_INFO_PAGES.payment_info_path : null)
  const shipping =
    frame.shipping_info_path ??
    (frame.shipping_info_path === undefined ? DEFAULT_INFO_PAGES.shipping_info_path : null)
  if (payments === path) {
    return "payments"
  }
  return shipping === path ? "shipping" : null
}
