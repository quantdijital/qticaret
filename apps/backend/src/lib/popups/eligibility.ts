import type {
  PopupDevice,
  PopupFrequency,
  PopupLayout,
  PopupMembership,
  PopupPage,
  PopupPageScope,
  PopupTrigger,
  PopupType,
  PopupVisitor,
} from "./rules"
import { POPUP_LIMITS } from "./rules"

/** A pop-up's fields as the module keeps them (adr/0080 §1). */
export interface PopupValues {
  name: string
  type: PopupType
  is_active: boolean
  starts_at: Date | string | null
  ends_at: Date | string | null
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

export interface PopupRecord extends PopupValues {
  id: string
}

/** A field and the error key that names what is wrong with it. */
export interface PopupProblem {
  key: string
  field: string
}

const time = (when: Date | string | null): number | null =>
  when === null ? null : new Date(when).getTime()

/**
 * What the fields say together that each alone cannot (the validators
 * check each one): the first problem, or null. Run on the merged record,
 * so an update that leaves a field out is checked with its stored value.
 */
export function popupProblem(values: PopupValues): PopupProblem | null {
  if (values.type === "campaign" && !values.promotion_id) {
    return { key: "popups.promotion_required", field: "promotion_id" }
  }
  if (values.type !== "campaign" && values.promotion_id) {
    return { key: "popups.promotion_not_allowed", field: "promotion_id" }
  }
  if (values.type === "newsletter" && values.button_href) {
    // The newsletter's button sends the form; it links nowhere
    return { key: "popups.button_link_not_allowed", field: "button_href" }
  }
  if (
    values.type !== "newsletter" &&
    Boolean(values.button_label) !== Boolean(values.button_href)
  ) {
    return { key: "popups.button_incomplete", field: "button_href" }
  }
  if (values.page_scope === "selected" && values.pages.length === 0) {
    return { key: "popups.pages_required", field: "pages" }
  }
  const delayed = values.trigger === "delay"
  if (
    values.trigger_value < (delayed ? 0 : 1) ||
    values.trigger_value > (delayed ? POPUP_LIMITS.delayMax : 100)
  ) {
    return { key: "popups.trigger_value_invalid", field: "trigger_value" }
  }
  if (values.frequency === "days" && !values.frequency_days) {
    return { key: "popups.frequency_days_required", field: "frequency_days" }
  }
  const starts = time(values.starts_at)
  const ends = time(values.ends_at)
  if (starts !== null && ends !== null && ends <= starts) {
    return { key: "popups.dates_invalid", field: "ends_at" }
  }
  return null
}

/**
 * The record as it is kept: what a type or a choice does not use is
 * emptied, so nothing left over from an earlier type shows later.
 */
export function normalizePopup<T extends PopupValues>(values: T): T {
  return {
    ...values,
    pages: values.page_scope === "selected" ? [...new Set(values.pages)] : [],
    frequency_days: values.frequency === "days" ? values.frequency_days : null,
    image_alt: values.image_url ? values.image_alt : null,
    button_href: values.type === "newsletter" ? null : values.button_href,
  }
}

/** A Medusa promotion as a campaign pop-up reads it. */
export interface PopupPromotion {
  id: string
  code: string | null
  status: string | null
  is_automatic: boolean | null
  limit: number | null
  used: number | null
  campaign: { starts_at: Date | string | null; ends_at: Date | string | null } | null
  /**
   * Whether a pop-up may show it (adr/0080 §2): false for a code meant for
   * one person (a single-use batch's copy, a payment link's code, a
   * promotion used at most once). Absent: allowed.
   */
  linkable?: boolean
}

export type PromotionState = "live" | "inactive" | "not_started" | "ended" | "used_up" | "missing"

/** Whether the promotion takes orders now; anything but `live` hides its pop-up. */
export function promotionState(promotion: PopupPromotion | null, now: Date): PromotionState {
  if (!promotion) {
    return "missing"
  }
  // A code meant for one person is never published, whatever its status
  if (promotion.linkable === false || promotion.status !== "active") {
    return "inactive"
  }
  const starts = time(promotion.campaign?.starts_at ?? null)
  const ends = time(promotion.campaign?.ends_at ?? null)
  if (starts !== null && starts > now.getTime()) {
    return "not_started"
  }
  if (ends !== null && ends <= now.getTime()) {
    return "ended"
  }
  if (promotion.limit !== null && promotion.limit > 0 && (promotion.used ?? 0) >= promotion.limit) {
    return "used_up"
  }
  return "live"
}

/** Where a pop-up stands, as the panel's list shows it. */
export type PopupState = "off" | "scheduled" | "live" | "ended" | "campaign_inactive"

export function popupState(
  popup: Pick<PopupValues, "is_active" | "starts_at" | "ends_at" | "type">,
  promotion: PromotionState | null,
  now: Date
): PopupState {
  const ends = time(popup.ends_at)
  if (ends !== null && ends <= now.getTime()) {
    return "ended"
  }
  if (!popup.is_active) {
    return "off"
  }
  const starts = time(popup.starts_at)
  if (starts !== null && starts > now.getTime()) {
    return "scheduled"
  }
  if (popup.type === "campaign" && promotion !== "live") {
    return "campaign_inactive"
  }
  return "live"
}

/** The earlier of two ends, either of which may be open. */
export function earlierEnd(
  first: Date | string | null,
  second: Date | string | null
): string | null {
  const ends = [time(first), time(second)].filter((each): each is number => each !== null)
  return ends.length === 0 ? null : new Date(Math.min(...ends)).toISOString()
}

/** The storefront's order: the higher priority first, then the newer. */
export function byPriority<T extends { priority: number; created_at?: Date | string | null }>(
  popups: readonly T[]
): T[] {
  return [...popups].sort(
    (a, b) =>
      b.priority - a.priority ||
      (time(b.created_at ?? null) ?? 0) - (time(a.created_at ?? null) ?? 0)
  )
}
