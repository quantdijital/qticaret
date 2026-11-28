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
  layoutSession,
  storefrontLayout,
  storefrontMenus,
  storefrontSettings,
} from "@/lib/store-api/requests"
import { designPreview } from "@/lib/store-api/design-preview"
import { imageView } from "./image"
import { menuLink } from "./menus"
import { menusOf, sharedSettingsOf } from "./shared-settings"

/** Set by the proxy on a design preview's address (adr/0049), never by a visitor. */
const LAYOUT_PREVIEW_HEADER = "x-qt-layout-preview"

const LAYOUT_TOKEN = /^sfl_[0-9A-Za-z]{1,40}\.[0-9a-z]{1,12}\.[\w-]{43}$/
// The theme editor's live session (adr/0065 §1)
const SESSION_TOKEN = /^sfs_[0-9a-f]{32}\.[0-9a-z]{1,12}\.[\w-]{43}$/
// A saved look's signed link (adr/0064)
const DESIGN_TOKEN = /^sfd_[0-9A-Za-z]{1,40}\.[0-9a-z]{1,12}\.[\w-]{43}$/

/**
 * Which preview a token's form is: the theme editor's live session, a
 * signed design link, a saved look's link, or neither (the backend checks
 * the token itself).
 */
export const previewTokenKind = (token: string): "session" | "link" | "design" | null =>
  SESSION_TOKEN.test(token)
    ? "session"
    : LAYOUT_TOKEN.test(token)
      ? "link"
      : DESIGN_TOKEN.test(token)
        ? "design"
        : null

/**
 * The design this request shows: the draft on a signed preview address
 * or the theme editor's live session (its header and footer too), else
 * the published one. A preview that no longer opens falls back to what is
 * live; its page says 404.
 */
export async function currentLayout(): Promise<StoreLayout> {
  const token = await layoutPreviewToken()
  const preview = token ? await previewLayoutOf(token) : null
  return preview ?? (await storefrontLayout())
}

/**
 * The preview token this request came on (its form only; the backend
 * checks it), a signed design link's or the theme editor's live
 * session's, or null.
 */
export async function layoutPreviewToken(): Promise<string | null> {
  const token = (await headers()).get(LAYOUT_PREVIEW_HEADER)
  return token && previewTokenKind(token) !== null ? token : null
}

/**
 * Whether this request is the theme editor's live session (adr/0065 §1):
 * its views say so (`editor`), and the theme marks its fields for the
 * editor's labels (Faz 2b). A shared design link and a live page never are,
 * nor a token of the session's form that opens none (a made-up or ended
 * one's 404; security review 2026-11-15, DÜŞÜK-2). The session is asked
 * through `layoutSession`'s request cache: the layout read for the same
 * request already asked, so no second call.
 */
export async function isEditorSession(): Promise<boolean> {
  const token = await layoutPreviewToken()
  return token !== null && SESSION_TOKEN.test(token) && (await layoutSession(token)) !== null
}

/**
 * The design a preview token opens: the live session's draft as last
 * saved, the signed link's draft, or a saved look's; null when it no
 * longer opens.
 */
export async function previewLayoutOf(token: string): Promise<StoreLayout | null> {
  switch (previewTokenKind(token)) {
    case "session":
      return (await layoutSession(token))?.layout ?? null
    case "link":
      return layoutPreview(token)
    case "design":
      return designPreview(token)
    case null:
      return null
  }
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

/**
 * A section's buttons as the theme prints them; a link with no name or
 * address is left out. Only then each printed one says its place among
 * the design's links (`actionsAt`), so the editor's field mark (adr/0065
 * Faz 2b) names the button saved, not the one drawn before it.
 */
export function layoutLinks(
  links: readonly StoreLayoutLink[],
  t: Translate
): { actions: LinkView[]; actionsAt?: number[] } {
  const actions: LinkView[] = []
  const at: number[] = []
  links.forEach((link, index) => {
    const view = layoutLink(link, t)
    if (view) {
      actions.push(view)
      at.push(index)
    }
  })
  return at.every((place, drawn) => place === drawn) ? { actions } : { actions, actionsAt: at }
}

/** A design picture with its sizes and versions; its alt text the shop's, else the media library's. */
export const layoutImage = (image: StoreLayoutImage, fallbackAlt: string): ImageView =>
  imageView(image, fallbackAlt)
