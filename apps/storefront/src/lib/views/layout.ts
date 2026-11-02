import "server-only"
import { headers } from "next/headers"
import type { StoreLayout, StoreLayoutImage, StoreLayoutLink } from "@qticaret/types"
import type { ImageView, LinkView, Translate } from "@qticaret/ui"
import { layoutPreview, storefrontLayout } from "@/lib/store-api/requests"
import { imageView } from "./image"
import { menuLink } from "./menus"

/** Set by the proxy on a design preview's address (adr/0049), never by a visitor. */
const LAYOUT_PREVIEW_HEADER = "x-qt-layout-preview"

/**
 * The design this request shows: the draft on a signed preview address
 * (its header and footer too), else the published one. A preview link
 * that no longer opens falls back to what is live; its page says 404.
 */
export async function currentLayout(): Promise<StoreLayout> {
  const token = (await headers()).get(LAYOUT_PREVIEW_HEADER)
  return (token ? await layoutPreview(token) : null) ?? (await storefrontLayout())
}

/** A button's or slide's link as the theme prints it; null when it has no name or address. */
export const layoutLink = (link: StoreLayoutLink | null, t: Translate): LinkView | null =>
  link ? menuLink({ ...link, children: [] }, t) : null

/** A design picture with its sizes and versions; its alt text the shop's, else the media library's. */
export const layoutImage = (image: StoreLayoutImage, fallbackAlt: string): ImageView =>
  imageView({ id: image.url, ...image }, fallbackAlt)
