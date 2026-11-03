/**
 * A campaign's links (adr/0050 §4): a path on the shop becomes the
 * storefront's address, and the shop's own links carry the campaign's
 * utm (`utm_source=magaza&utm_medium=email|sms&utm_campaign=<code>`), so
 * the sales report finds what it brought (F11.2). A link elsewhere is
 * left as written; nothing tracks a person (no redirect, no pixel).
 */

const hostOf = (value: string): string | null => {
  try {
    return new URL(value).host.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

/** The link as the message carries it; null for a shop path while the shop has no domain. */
export function campaignLink(
  href: string,
  storefrontUrl: string | null,
  medium: "email" | "sms",
  code: string
): string | null {
  const absolute = href.startsWith("/")
    ? storefrontUrl
      ? `${storefrontUrl.replace(/\/+$/, "")}${href}`
      : null
    : href
  if (!absolute) {
    return null
  }
  const shop = storefrontUrl ? hostOf(storefrontUrl) : null
  if (!shop || hostOf(absolute) !== shop) {
    return absolute
  }
  const url = new URL(absolute)
  url.searchParams.set("utm_source", "magaza")
  url.searchParams.set("utm_medium", medium)
  url.searchParams.set("utm_campaign", code)
  return url.toString()
}
