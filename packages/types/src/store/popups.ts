/**
 * Storefront pop-ups (adr/0080 §5): `GET /store/popups` and
 * `POST /store/popups/:id/events`. A copy of the backend's
 * `lib/popups/store.ts`: the backend's build does not compile workspace
 * TypeScript (adr/0046 §8).
 */
import type { MediaDerivatives } from "./catalog.js"

export type StorePopupType = "info" | "campaign" | "newsletter"

/** How a pop-up looks inside; `classic` is the first design, every older pop-up's. */
export type StorePopupDesign = "classic" | "split" | "hero" | "minimal" | "coupon"

/** The pages a pop-up may target; `all` adds every other page but the blocked ones. */
export type StorePopupPage = "home" | "category" | "product" | "content"

export interface StorePopup {
  id: string
  type: StorePopupType
  title: string
  /** Plain text; `\n` separates lines. Never HTML. */
  body: string | null
  /** The library's picture with its size, so the dialog keeps its place. */
  image: {
    url: string
    alt: string | null
    width: number | null
    height: number | null
    derivatives: MediaDerivatives | null
  } | null
  /** An info or campaign pop-up's link (a path on the shop or https); null: no button. */
  button: { label: string; href: string } | null
  /** A newsletter pop-up's submit button; null: the theme's own words. */
  submit_label: string | null
  /** A campaign pop-up's code to copy; `code` null when it applies on its own in the cart. */
  promotion: { code: string | null; automatic: boolean } | null
  targeting: {
    pages: "all" | StorePopupPage[]
    device: "all" | "desktop" | "mobile"
    visitor: "any" | "new" | "returning"
    membership: "any" | "member" | "guest"
  }
  /** After `value` seconds, or after `value` % of the page is scrolled. */
  trigger: { kind: "delay" | "scroll"; value: number }
  /** Once a session, once every `days` days, or every session until closed. */
  frequency: { kind: "session" | "days" | "until_closed"; days: number | null }
  /** A wide screen's dialog or corner card; a phone draws either as a bottom sheet. */
  layout: "modal" | "corner"
  /** How it looks inside (adr/0080 §6a), whatever its type and place. */
  design: StorePopupDesign
  priority: number
  /** ISO time it stops showing; null: open. */
  ends_at: string | null
}

/** `GET /store/popups`: live ones, highest priority first. */
export interface StorePopupsResponse {
  popups: StorePopup[]
}

/** `POST /store/popups/:id/events` body; answers 204. */
export interface StorePopupEvent {
  type: "impression" | "click" | "close" | "signup"
}
