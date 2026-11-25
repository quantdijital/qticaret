/**
 * Storefront pop-ups (adr/0080): the lists a pop-up's fields are chosen
 * from and the limits of its text. Shared by the model, the admin's
 * validators and the store's answer, so the three never disagree.
 */

/** What a pop-up offers (adr/0080 §2). */
export const POPUP_TYPES = ["info", "campaign", "newsletter"] as const
export type PopupType = (typeof POPUP_TYPES)[number]

/**
 * The storefront pages a pop-up may stand on (adr/0080 §3). The cart, the
 * checkout, the payment and the account pages are never among them: a
 * pop-up there stands between a shopper and their order.
 */
export const POPUP_PAGES = ["home", "category", "product", "content"] as const
export type PopupPage = (typeof POPUP_PAGES)[number]

/** `all`: every page above; `selected`: the ones in `pages`. */
export const POPUP_PAGE_SCOPES = ["all", "selected"] as const
export type PopupPageScope = (typeof POPUP_PAGE_SCOPES)[number]

export const POPUP_DEVICES = ["all", "desktop", "mobile"] as const
export type PopupDevice = (typeof POPUP_DEVICES)[number]

/** First visit or a returning one, as the storefront's own functional storage knows. */
export const POPUP_VISITORS = ["any", "new", "returning"] as const
export type PopupVisitor = (typeof POPUP_VISITORS)[number]

/** Signed in (a customer) or not. */
export const POPUP_MEMBERSHIPS = ["any", "member", "guest"] as const
export type PopupMembership = (typeof POPUP_MEMBERSHIPS)[number]

/** After `trigger_value` seconds on the page, or after `trigger_value` % of it is scrolled. */
export const POPUP_TRIGGERS = ["delay", "scroll"] as const
export type PopupTrigger = (typeof POPUP_TRIGGERS)[number]

/**
 * How often one visitor sees it: once a browser session, once every
 * `frequency_days` days, or every visit until they close it once.
 */
export const POPUP_FREQUENCIES = ["session", "days", "until_closed"] as const
export type PopupFrequency = (typeof POPUP_FREQUENCIES)[number]

/**
 * How it is drawn on a wide screen: a centred dialog or a card in the
 * corner. A phone draws either as a bottom sheet, never full screen
 * (adr/0080 §6).
 */
export const POPUP_LAYOUTS = ["modal", "corner"] as const
export type PopupLayout = (typeof POPUP_LAYOUTS)[number]

/**
 * How it looks inside, whatever its type and place (adr/0080 §6a):
 * `classic` the picture above the words (the first design, every older
 * pop-up's); `split` the picture beside them on a wide screen; `hero` a
 * tall picture with the words centred under it; `minimal` the words alone,
 * centred, a large title; `coupon` a ticket with the campaign's code large
 * (the title in its place when there is no code). Separate from `layout`,
 * which says where it stands.
 */
export const POPUP_DESIGNS = ["classic", "split", "hero", "minimal", "coupon"] as const
export type PopupDesign = (typeof POPUP_DESIGNS)[number]

/** What the storefront counts (adr/0080 §7). */
export const POPUP_EVENTS = ["impression", "click", "close", "signup"] as const
export type PopupEvent = (typeof POPUP_EVENTS)[number]

/** The counter column each event adds to. */
export const POPUP_EVENT_COLUMNS: Readonly<Record<PopupEvent, string>> = Object.freeze({
  impression: "impressions",
  click: "clicks",
  close: "closes",
  signup: "signups",
})

export const POPUP_LIMITS = {
  name: 120,
  title: 80,
  body: 500,
  /** Lines in the body: a pop-up is a few sentences, not a page. */
  bodyLines: 8,
  imageAlt: 160,
  buttonLabel: 40,
  href: 2048,
  /** Seconds before it opens. */
  delayMax: 120,
  /** Days between two showings. */
  daysMax: 365,
  priorityMax: 1000,
} as const

/** The defaults a new pop-up starts from. */
export const POPUP_DEFAULTS = {
  page_scope: "all",
  pages: [],
  device: "all",
  visitor: "any",
  membership: "any",
  trigger: "delay",
  trigger_value: 5,
  frequency: "days",
  frequency_days: 7,
  layout: "modal",
  design: "classic",
  priority: 0,
  is_active: false,
} as const satisfies Record<string, unknown>

/** Whether an event name is one the storefront may send. */
export const isPopupEvent = (value: unknown): value is PopupEvent =>
  typeof value === "string" && (POPUP_EVENTS as readonly string[]).includes(value)
