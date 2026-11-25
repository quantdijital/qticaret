import type { ImageView } from "./views"

/**
 * The shop's pop-ups (adr/0080 §6, S3): what the storefront answers at the
 * theme's `popups.address` after the page is up, never in its first HTML.
 * The words are the shop's (plain text, never HTML); the rules are the
 * backend's (`GET /store/popups`), applied in the browser by the shared
 * `@qticaret/ui/lib/popup-rules`.
 */

export type PopupType = "info" | "campaign" | "newsletter"

/**
 * How a pop-up looks inside (adr/0080 §6a), whatever its type and place:
 * `classic` the picture above the words; `split` the picture beside them
 * on a wide screen; `hero` a tall picture, the words centred under it;
 * `minimal` the words alone, centred; `coupon` a ticket with the code large.
 */
export type PopupDesign = "classic" | "split" | "hero" | "minimal" | "coupon"

/** A page a pop-up may name; `all` takes every other page too but the blocked ones. */
export type PopupTargetPage = "home" | "category" | "product" | "content"

/** The page being viewed; the pages from the cart on are never a pop-up's. */
export type PopupPageKind =
  | PopupTargetPage
  | "cart"
  | "checkout"
  | "payment"
  | "account"
  /** Every other page (search, brand, collection, a listing, the blog's index). */
  | "other"

export interface PopupView {
  id: string
  type: PopupType
  /** One line, plain text. */
  title: string
  /** Plain text; `\n` separates lines. Null: none. */
  body: string | null
  /** The library's picture with its size; its alt the shop's, else empty (decorative). */
  image: ImageView | null
  /** An info or campaign pop-up's link: a path on the shop or an https address. */
  button: { label: string; href: string } | null
  /** A newsletter pop-up's submit button; null: the theme's own words. */
  submitLabel: string | null
  /** A campaign's code to copy; `code` null when the cart applies it by itself. */
  promotion: { code: string | null; automatic: boolean } | null
  targeting: {
    pages: "all" | PopupTargetPage[]
    device: "all" | "desktop" | "mobile"
    visitor: "any" | "new" | "returning"
    membership: "any" | "member" | "guest"
  }
  /** After `value` seconds, or after `value` % of the page is scrolled. */
  trigger: { kind: "delay" | "scroll"; value: number }
  /** Once a session, once every `days` days, or every session until closed. */
  frequency: { kind: "session" | "days" | "until_closed"; days: number | null }
  /** A wide screen's dialog in the middle or a card in the corner; a phone always a bottom sheet. */
  layout: "modal" | "corner"
  /** How it looks inside; a theme without one draws `classic`. */
  design: PopupDesign
  priority: number
  /** ISO time it stops showing; null: open. */
  endsAt: string | null
}

/** How a pop-up is drawn now: a phone's bottom sheet whatever its layout. */
export type PopupMode = "modal" | "corner" | "sheet"

/** What a visitor did with a pop-up, counted by the backend (`POST /store/popups/:id/events`). */
export type PopupEventType = "impression" | "click" | "close" | "signup"

/**
 * The layout's pop-ups, given only while the shop has them on
 * (`features.popups`) and never on the paying pages' frame.
 */
export interface PopupSetup {
  /** `GET {address}` answers `{ popups: PopupView[] }`, highest priority first. */
  address: string
  /** `POST {events}/{id}/events` with `{ type: PopupEventType }`; answers 204. */
  events: string
}
