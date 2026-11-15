import type { SocialNetwork } from "@qticaret/types"
import type { FooterGroupView, NavCategoryView, SocialLinkView } from "@qticaret/ui"
import type { Translate } from "@qticaret/ui"

const TURKISH_MOBILE = /^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/

/** `+905321234567` as a Turkish shopper reads it: `0532 123 45 67`. */
export function displayPhone(e164: string): string {
  const parts = TURKISH_MOBILE.exec(e164)
  return parts ? `0${parts.slice(1).join(" ")}` : e164
}

/** A WhatsApp chat with the shop (`wa.me` takes the number without its `+`). */
export const whatsappHref = (e164: string): string => `https://wa.me/${e164.replace(/^\+/, "")}`

/** Each network the theme draws a glyph for, by the profile address's host. */
const NETWORKS: readonly [RegExp, SocialNetwork, string][] = [
  [/(^|\.)instagram\.com$/, "instagram", "Instagram"],
  [/(^|\.)facebook\.com$/, "facebook", "Facebook"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube", "YouTube"],
  [/(^|\.)(x\.com|twitter\.com)$/, "x", "X"],
  [/(^|\.)tiktok\.com$/, "tiktok", "TikTok"],
  [/(^|\.)pinterest\.[a-z.]+$/, "pinterest", "Pinterest"],
  [/(^|\.)linkedin\.com$/, "linkedin", "LinkedIn"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "whatsapp", "WhatsApp"],
]

/**
 * The shop's profiles (`same_as`, its store details' social accounts)
 * named by their network; an unknown one by its host, without a network.
 * Only https addresses, as the store details take them: anything else a
 * stale record or a tampered answer, left out.
 */
export function socialLinks(sameAs: readonly string[]): SocialLinkView[] {
  return sameAs.flatMap((href) => {
    let url: URL
    try {
      url = new URL(href)
    } catch {
      return []
    }
    if (url.protocol !== "https:") {
      return []
    }
    const host = url.hostname.toLowerCase()
    const network = NETWORKS.find(([pattern]) => pattern.test(host))
    return [
      network
        ? { label: network[2], href, network: network[1] }
        : { label: host.replace(/^www\./, ""), href, network: null },
    ]
  })
}

const DEFAULT_FOOTER_CATEGORIES = 8

/**
 * The footer's columns: the shop's own footer menus (adr/0049), else the
 * storefront's, so a new shop's footer still leads somewhere: its top
 * categories and its cart.
 */
export function footerGroups(
  own: readonly FooterGroupView[],
  categories: readonly NavCategoryView[],
  t: Translate
): FooterGroupView[] {
  if (own.length > 0) {
    return [...own]
  }
  const groups: FooterGroupView[] = []
  if (categories.length > 0) {
    groups.push({
      title: t("footer.categories"),
      links: categories
        .slice(0, DEFAULT_FOOTER_CATEGORIES)
        .map(({ label, path }) => ({ label, path })),
    })
  }
  groups.push({ title: t("footer.help"), links: [{ label: t("footer.cart"), path: "/sepet" }] })
  return groups
}
