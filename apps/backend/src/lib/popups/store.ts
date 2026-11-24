import type { PopupPromotion, PopupRecord } from "./eligibility"
import { earlierEnd } from "./eligibility"
import type {
  PopupDevice,
  PopupFrequency,
  PopupLayout,
  PopupMembership,
  PopupPage,
  PopupTrigger,
  PopupType,
  PopupVisitor,
} from "./rules"

/** The picture as the media library knows it: its size, so the dialog keeps its place. */
export interface StorePopupImage {
  url: string
  alt: string | null
  width: number | null
  height: number | null
  derivatives: unknown
}

/**
 * One pop-up as `GET /store/popups` gives it (adr/0080 §5): only what the
 * storefront draws and decides with. Its panel name, its switch, its
 * start, its promotion's id and its timestamps stay inside. A copy lives
 * in `packages/types` (`StorePopup`).
 */
export interface StorePopup {
  id: string
  type: PopupType
  title: string
  body: string | null
  image: StorePopupImage | null
  /** An info or campaign pop-up's link; null: no button. */
  button: { label: string; href: string } | null
  /** A newsletter pop-up's submit button; null: the theme's own words. */
  submit_label: string | null
  /** A campaign pop-up's code; `code` null when the promotion applies on its own. */
  promotion: { code: string | null; automatic: boolean } | null
  targeting: {
    /** `all`: every page a pop-up may stand on; never the cart, checkout, payment or account. */
    pages: "all" | PopupPage[]
    device: PopupDevice
    visitor: PopupVisitor
    membership: PopupMembership
  }
  trigger: { kind: PopupTrigger; value: number }
  frequency: { kind: PopupFrequency; days: number | null }
  layout: PopupLayout
  priority: number
  /** When it stops showing (its own end or its campaign's, the earlier); null: open. */
  ends_at: string | null
}

export interface StorePopupParts {
  image: StorePopupImage | null
  promotion: PopupPromotion | null
}

/** The record as the storefront receives it. */
export function storePopupOf(popup: PopupRecord, parts: StorePopupParts): StorePopup {
  const { promotion } = parts
  return {
    id: popup.id,
    type: popup.type,
    title: popup.title,
    body: popup.body,
    image: parts.image,
    button:
      popup.type !== "newsletter" && popup.button_label && popup.button_href
        ? { label: popup.button_label, href: popup.button_href }
        : null,
    submit_label: popup.type === "newsletter" ? popup.button_label : null,
    promotion:
      popup.type === "campaign" && promotion
        ? {
            code: promotion.is_automatic ? null : promotion.code,
            automatic: promotion.is_automatic === true,
          }
        : null,
    targeting: {
      pages: popup.page_scope === "all" ? "all" : [...popup.pages],
      device: popup.device,
      visitor: popup.visitor,
      membership: popup.membership,
    },
    trigger: { kind: popup.trigger, value: popup.trigger_value },
    frequency: {
      kind: popup.frequency,
      days: popup.frequency === "days" ? popup.frequency_days : null,
    },
    layout: popup.layout,
    priority: popup.priority,
    ends_at: earlierEnd(
      popup.ends_at,
      popup.type === "campaign" ? (promotion?.campaign?.ends_at ?? null) : null
    ),
  }
}
