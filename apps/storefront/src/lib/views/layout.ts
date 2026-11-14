import "server-only"
import { headers } from "next/headers"
import type {
  StoreLayout,
  StoreLayoutImage,
  StoreLayoutLink,
  StoreLayoutSettings,
  StoreMenu,
} from "@qticaret/types"
import type { ImageView, LinkView, Translate } from "@qticaret/ui"
import {
  layoutPreview,
  storefrontLayout,
  storefrontMenus,
  storefrontSettings,
} from "@/lib/store-api/requests"
import { imageView } from "./image"
import { menuLink } from "./menus"
import { menusOf, sharedSettingsOf } from "./shared-settings"

/** Set by the proxy on a design preview's address (adr/0049), never by a visitor. */
const LAYOUT_PREVIEW_HEADER = "x-qt-layout-preview"

const LAYOUT_TOKEN = /^sfl_[0-9A-Za-z]{1,40}\.[0-9a-z]{1,12}\.[\w-]{43}$/

/**
 * The design this request shows: the draft on a signed preview address
 * (its header and footer too), else the published one. A preview link
 * that no longer opens falls back to what is live; its page says 404.
 */
export async function currentLayout(): Promise<StoreLayout> {
  const token = (await headers()).get(LAYOUT_PREVIEW_HEADER)
  const preview = token && LAYOUT_TOKEN.test(token) ? await layoutPreview(token) : null
  return preview ?? (await storefrontLayout())
}

/**
 * The trust badges and colour names this request shows (adr/0049 Ek
 * 2026-11-06): the design's (a preview's draft on its address), else the
 * frame's from an older backend.
 */
export async function currentShared(): Promise<StoreLayoutSettings> {
  const [layout, answer] = await Promise.all([currentLayout(), storefrontSettings()])
  return sharedSettingsOf(layout, answer.storefront)
}

/**
 * The menus this request prints (adr/0063 §3): a preview's draft may carry
 * the set it would put live; else the shop's live menus.
 */
export async function currentMenus(): Promise<StoreMenu[]> {
  const [layout, live] = await Promise.all([currentLayout(), storefrontMenus()])
  return menusOf(layout, live)
}

/** A button's or slide's link as the theme prints it; null when it has no name or address. */
export const layoutLink = (link: StoreLayoutLink | null, t: Translate): LinkView | null =>
  link ? menuLink({ ...link, children: [] }, t) : null

/** A design picture with its sizes and versions; its alt text the shop's, else the media library's. */
export const layoutImage = (image: StoreLayoutImage, fallbackAlt: string): ImageView =>
  imageView(image, fallbackAlt)
