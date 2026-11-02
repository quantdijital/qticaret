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

const NETWORKS: readonly [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)facebook\.com$/, "Facebook"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)(x\.com|twitter\.com)$/, "X"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)pinterest\.[a-z.]+$/, "Pinterest"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
]

/** The shop's profiles (`same_as`) named by their network; an unknown one by its host. */
export function socialLinks(sameAs: readonly string[]): SocialLinkView[] {
  return sameAs.flatMap((href) => {
    let host: string
    try {
      host = new URL(href).hostname.toLowerCase()
    } catch {
      return []
    }
    const network = NETWORKS.find(([pattern]) => pattern.test(host))
    return [{ label: network ? network[1] : host.replace(/^www\./, ""), href }]
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
