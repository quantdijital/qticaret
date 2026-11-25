import type {
  PopupDesign,
  PopupEventType,
  PopupPageKind,
  PopupSetup,
  PopupView,
} from "@qticaret/ui"
import type { StorePopup } from "@qticaret/types/popups"
import { storefrontSettings } from "@/lib/store-api/requests"
import { imageView } from "./image"

/** The storefront's list of pop-ups (the layout's `popups.address`): `GET`. */
export const POPUPS_PATH = "/api/popups"

/** The layout's pop-ups: the list and the counters (`POST {POPUPS_PATH}/{id}/events`). */
export const POPUP_SETUP: PopupSetup = { address: POPUPS_PATH, events: POPUPS_PATH }

/**
 * Whether the shop has pop-ups on now (`/store/storefront` `features.popups`,
 * adr/0080 §5): the frame's answer every page already has. Off unless it
 * says `true` (a backend before the flag has no pop-ups to ask for), so a
 * shop without them never sends the browser's request at all.
 */
export async function popupsOn(): Promise<boolean> {
  const { features } = await storefrontSettings()
  return features?.popups === true
}

// The backend's pop-up ids: `popup_` and a ULID; anything else is refused before the backend
const POPUP_ID = /^popup_[0-9A-Za-z]{1,64}$/

/** A pop-up's id from the address, or null for anything not one. */
export const popupIdOf = (value: string | undefined): string | null =>
  value !== undefined && POPUP_ID.test(value) ? value : null

const EVENT_TYPES: readonly PopupEventType[] = ["impression", "click", "close", "signup"]

/** A counter's name from the browser's body, or null for anything else. */
export function popupEventOf(body: unknown): PopupEventType | null {
  const type = (body as { type?: unknown } | null)?.type
  return EVENT_TYPES.find((each) => each === type) ?? null
}

/** A resolved record's page as the pop-ups' targeting names it; every other record "other". */
export function popupPageOfEntity(entityType: string): PopupPageKind {
  switch (entityType) {
    case "product":
      return "product"
    case "product_category":
      return "category"
    case "page":
    case "post":
      return "content"
    default:
      return "other"
  }
}

const DESIGNS: readonly string[] = ["classic", "split", "hero", "minimal", "coupon"]

/** The pop-up's design; one this storefront does not know (a newer backend's) is drawn `classic`. */
const designOf = (design: unknown): PopupDesign =>
  typeof design === "string" && DESIGNS.includes(design) ? (design as PopupDesign) : "classic"

/**
 * One pop-up as the theme draws it: the backend's answer with its picture
 * as the theme's image (its versions, its size for the dialog's place).
 * A picture without alt text is decorative: the title beside it says it.
 */
export function popupView(popup: StorePopup): PopupView {
  return {
    id: popup.id,
    type: popup.type,
    title: popup.title,
    body: popup.body,
    image: popup.image ? imageView(popup.image, "") : null,
    button: popup.button,
    submitLabel: popup.submit_label,
    promotion: popup.promotion,
    targeting: popup.targeting,
    trigger: popup.trigger,
    frequency: popup.frequency,
    layout: popup.layout,
    design: designOf(popup.design),
    priority: popup.priority,
    endsAt: popup.ends_at,
  }
}
