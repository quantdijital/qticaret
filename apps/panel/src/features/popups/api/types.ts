/**
 * Storefront pop-ups as the admin API answers them (adr/0080 §5; backend
 * `workflows/popups/reads.ts`, `lib/popups/rules.ts`). A copy of the
 * backend's lists and limits, so the form says a mistake before saving.
 */

/** The shop flag that turns pop-ups on and off (on by default, adr/0012). */
export const POPUPS_FLAG = "marketing.popups"

export const POPUP_TYPES = ["info", "campaign", "newsletter"] as const
export type PopupType = (typeof POPUP_TYPES)[number]

export const POPUP_PAGES = ["home", "category", "product", "content"] as const
export type PopupPage = (typeof POPUP_PAGES)[number]

export const POPUP_PAGE_SCOPES = ["all", "selected"] as const
export type PopupPageScope = (typeof POPUP_PAGE_SCOPES)[number]

export const POPUP_DEVICES = ["all", "desktop", "mobile"] as const
export type PopupDevice = (typeof POPUP_DEVICES)[number]

export const POPUP_VISITORS = ["any", "new", "returning"] as const
export type PopupVisitor = (typeof POPUP_VISITORS)[number]

export const POPUP_MEMBERSHIPS = ["any", "member", "guest"] as const
export type PopupMembership = (typeof POPUP_MEMBERSHIPS)[number]

export const POPUP_TRIGGERS = ["delay", "scroll"] as const
export type PopupTrigger = (typeof POPUP_TRIGGERS)[number]

export const POPUP_FREQUENCIES = ["session", "days", "until_closed"] as const
export type PopupFrequency = (typeof POPUP_FREQUENCIES)[number]

export const POPUP_LAYOUTS = ["modal", "corner"] as const
export type PopupLayout = (typeof POPUP_LAYOUTS)[number]

export const POPUP_STATES = ["off", "scheduled", "live", "ended", "campaign_inactive"] as const
export type PopupState = (typeof POPUP_STATES)[number]

export type PopupPromotionState =
  "live" | "inactive" | "not_started" | "ended" | "used_up" | "missing"

export const POPUP_LIMITS = {
  name: 120,
  title: 80,
  body: 500,
  bodyLines: 8,
  imageAlt: 160,
  buttonLabel: 40,
  href: 2048,
  delayMax: 120,
  scrollMax: 100,
  daysMax: 365,
  priorityMax: 1000,
} as const

export interface PopupCounts {
  impressions: number
  clicks: number
  closes: number
  signups: number
}

export interface PopupDayCounts extends PopupCounts {
  /** `YYYY-MM-DD`, UTC. */
  day: string
}

/** `AdminPopup`: every field, where it stands now and its counts all time. */
export interface Popup {
  id: string
  name: string
  type: PopupType
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  priority: number
  title: string
  body: string | null
  image_url: string | null
  image_alt: string | null
  button_label: string | null
  button_href: string | null
  promotion_id: string | null
  page_scope: PopupPageScope
  pages: PopupPage[]
  device: PopupDevice
  visitor: PopupVisitor
  membership: PopupMembership
  trigger: PopupTrigger
  trigger_value: number
  frequency: PopupFrequency
  frequency_days: number | null
  layout: PopupLayout
  created_at: string
  updated_at: string
  state: PopupState
  promotion: { id: string; code: string | null; state: PopupPromotionState } | null
  counts: PopupCounts
}

/** `AdminPopupDetail`: the last 30 days with any count, oldest first. */
export interface PopupDetail extends Popup {
  daily: PopupDayCounts[]
}

export interface PopupList {
  popups: Popup[]
  count: number
  offset: number
  limit: number
}

/** What a save sends (`POST /admin/popups`, `POST /admin/popups/:id`). */
export interface PopupInput {
  name: string
  type: PopupType
  is_active?: boolean
  starts_at: string | null
  ends_at: string | null
  priority: number
  title: string
  body: string | null
  image_url: string | null
  image_alt: string | null
  button_label: string | null
  button_href: string | null
  promotion_id: string | null
  page_scope: PopupPageScope
  pages: PopupPage[]
  device: PopupDevice
  visitor: PopupVisitor
  membership: PopupMembership
  trigger: PopupTrigger
  trigger_value: number
  frequency: PopupFrequency
  frequency_days: number | null
  layout: PopupLayout
}
