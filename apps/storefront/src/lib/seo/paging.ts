import type { SeoPayload } from "@qticaret/types"
import type { Translate } from "@qticaret/ui"

/**
 * A list's later page as its own page (docs/13 §3): every paginated list
 * (category, brand, collection, landing, `/kampanyalar`, `/magaza`,
 * `/blog` and its archives, an author's page, `/yorumlar`) names its page
 * here and nowhere else. The first page is left as it is.
 */

/** A search result title's upper bound (docs/13 §3, the advisor's TITLE-01). */
const TITLE_MAX = 60

// The joiners the backend's titles use (`lib/seo/template.ts`), with a space on each side
const JOINER = String.raw`[|›»>/·•–—~\-]`
const SPACED_JOINER = new RegExp(String.raw`\s+${JOINER}\s+`, "gu")
const LEFTOVER = new RegExp(String.raw`(?:\s|[,:;]|${JOINER})+$`, "u")

const keyOf = (text: string): string =>
  text.normalize("NFC").toLocaleLowerCase("tr-TR").replace(/\s+/gu, " ").trim()
const lengthOf = (text: string): number => Array.from(text).length

/** `?sayfa=N` on a list's address; the bare address for the first page. */
export const pagedPath = (base: string, page: number): string =>
  page > 1 ? `${base}?sayfa=${String(page)}` : base

// The title split before the shop's name when that is its last part (`… | Mağaza`)
function splitShop(title: string, shop: string): { head: string; tail: string } {
  const last = [...title.matchAll(SPACED_JOINER)].at(-1)
  if (!shop.trim() || last?.index === undefined) {
    return { head: title, tail: "" }
  }
  const tail = title.slice(last.index)
  return keyOf(tail.slice(last[0].length)) === keyOf(shop)
    ? { head: title.slice(0, last.index), tail }
    : { head: title, tail: "" }
}

// Cut at a word boundary to `room` characters, the ellipsis included; whole when no word fits
function shortened(head: string, room: number): string {
  if (lengthOf(head) <= room) {
    return head
  }
  // One character more than the room: a word that ends right at it is kept
  const start = Array.from(head).slice(0, Math.max(0, room)).join("")
  const cut = start.slice(0, Math.max(0, start.lastIndexOf(" "))).replace(LEFTOVER, "")
  return cut ? `${cut}…` : head
}

/**
 * `<title> – Sayfa N`, before the shop's name when the title ends with it
 * (`Kupalar – Sayfa 2 | Mağaza`): the name stays last and once. Should the
 * page number push the title past 60 characters, the part before it is cut
 * at a word boundary, so the number and the shop's name still show.
 */
export function pageTitle(title: string, page: number, shop: string, t: Translate): string {
  if (page <= 1) {
    return title
  }
  const suffix = ` – ${t("listing.page_n", { page })}`
  const { head, tail } = splitShop(title, shop)
  return `${shortened(head, TITLE_MAX - lengthOf(suffix) - lengthOf(tail))}${suffix}${tail}`
}

const isBare = (canonical: string, path: string): boolean => {
  try {
    const url = new URL(canonical)
    return url.search === "" && url.pathname === path
  } catch {
    return false
  }
}

/**
 * The backend's `seo` object for page `page`: its titles name the page.
 * With `selfPath` (a list whose backend answer is the first page's, a blog
 * archive or an author), a canonical at that bare address becomes the
 * page's own; one the shop pointed elsewhere stays. A listing's canonical
 * comes paged from resolve already (filters considered), so it has none.
 */
export function pagedSeo(
  seo: SeoPayload,
  page: number,
  t: Translate,
  selfPath?: string
): SeoPayload {
  if (page <= 1) {
    return seo
  }
  const shop = seo.openGraph.siteName
  const titled = (title: string) => pageTitle(title, page, shop, t)
  const canonical =
    selfPath && seo.canonical && isBare(seo.canonical, selfPath)
      ? pagedPath(seo.canonical, page)
      : seo.canonical
  return {
    ...seo,
    title: titled(seo.title),
    canonical,
    openGraph: {
      ...seo.openGraph,
      title: titled(seo.openGraph.title),
      url: canonical === seo.canonical ? seo.openGraph.url : canonical,
    },
    twitter: { ...seo.twitter, title: titled(seo.twitter.title) },
  }
}
