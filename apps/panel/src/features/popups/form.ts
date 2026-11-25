import { z } from "zod"
import { isSafeHref } from "@/features/content/editor/href"
import { isCleanText } from "@/features/settings/storefront"
import { toOffsetIso } from "@/features/storefront/maintenance"
import { toLocalInput } from "@/features/storefront/layout/schedule"
import {
  POPUP_DESIGNS,
  POPUP_DEVICES,
  POPUP_FREQUENCIES,
  POPUP_LAYOUTS,
  POPUP_LIMITS,
  POPUP_MEMBERSHIPS,
  POPUP_PAGES,
  POPUP_PAGE_SCOPES,
  POPUP_TRIGGERS,
  POPUP_TYPES,
  POPUP_VISITORS,
} from "./api/types"
import type { Popup, PopupDesign, PopupInput, PopupType } from "./api/types"

/**
 * The pop-up form (adr/0080 §1): the backend's limits and what its fields
 * say together (`lib/popups/eligibility.ts` `popupProblem`), so a mistake
 * shows under its field before the save. The server checks all again.
 */

const E = "popups.errors"

// Invisible format characters (bidi overrides) make a line read as another
const FORMAT = /\p{Cf}/u
const plain = (text: string) => isCleanText(text) && !FORMAT.test(text)
const bodyLines = (text: string) => text.replace(/\r\n?/g, "\n").trim().split("\n")

const line = (max: number) =>
  z
    .string()
    .max(max, { message: `${E}.tooLong` })
    .refine(plain, { message: `${E}.textInvalid` })

export const popupSchema = z
  .object({
    name: line(POPUP_LIMITS.name).refine((text) => text.trim() !== "", {
      message: `${E}.nameRequired`,
    }),
    type: z.enum(POPUP_TYPES),
    is_active: z.boolean(),
    title: line(POPUP_LIMITS.title).refine((text) => text.trim() !== "", {
      message: `${E}.titleRequired`,
    }),
    body: z
      .string()
      .refine((text) => text.replace(/\r\n?/g, "\n").trim().length <= POPUP_LIMITS.body, {
        message: `${E}.tooLong`,
      })
      .refine((text) => bodyLines(text).length <= POPUP_LIMITS.bodyLines, {
        message: `${E}.tooManyLines`,
      })
      .refine((text) => bodyLines(text).every(plain), { message: `${E}.textInvalid` }),
    image_url: z.string(),
    image_alt: line(POPUP_LIMITS.imageAlt),
    button_label: line(POPUP_LIMITS.buttonLabel),
    button_href: z
      .string()
      .refine((text) => text.trim() === "" || isSafeHref(text), { message: `${E}.linkInvalid` }),
    promotion_id: z.string(),
    page_scope: z.enum(POPUP_PAGE_SCOPES),
    pages: z.array(z.enum(POPUP_PAGES)),
    device: z.enum(POPUP_DEVICES),
    visitor: z.enum(POPUP_VISITORS),
    membership: z.enum(POPUP_MEMBERSHIPS),
    trigger: z.enum(POPUP_TRIGGERS),
    trigger_value: z.number({ message: `${E}.number` }).int({ message: `${E}.number` }),
    frequency: z.enum(POPUP_FREQUENCIES),
    frequency_days: z.number({ message: `${E}.number` }).int({ message: `${E}.number` }),
    layout: z.enum(POPUP_LAYOUTS),
    design: z.enum(POPUP_DESIGNS),
    priority: z
      .number({ message: `${E}.number` })
      .int({ message: `${E}.number` })
      .min(0, { message: `${E}.priority` })
      .max(POPUP_LIMITS.priorityMax, { message: `${E}.priority` }),
    starts_at: z.string(),
    ends_at: z.string(),
  })
  .superRefine((values, ctx) => {
    const fail = (path: string, key: string) => {
      ctx.addIssue({ code: "custom", path: [path], message: `${E}.${key}` })
    }
    if (values.type === "campaign" && values.promotion_id === "") {
      fail("promotion_id", "promotionRequired")
    }
    if (values.type !== "newsletter") {
      const label = values.button_label.trim() !== ""
      const href = values.button_href.trim() !== ""
      if (label && !href) {
        fail("button_href", "buttonLinkRequired")
      }
      if (href && !label) {
        fail("button_label", "buttonLabelRequired")
      }
    }
    if (values.page_scope === "selected" && values.pages.length === 0) {
      fail("pages", "pagesRequired")
    }
    const delayed = values.trigger === "delay"
    const [low, high] = delayed ? [0, POPUP_LIMITS.delayMax] : [1, POPUP_LIMITS.scrollMax]
    if (values.trigger_value < low || values.trigger_value > high) {
      fail("trigger_value", delayed ? "delayRange" : "scrollRange")
    }
    if (
      values.frequency === "days" &&
      (values.frequency_days < 1 || values.frequency_days > POPUP_LIMITS.daysMax)
    ) {
      fail("frequency_days", "daysRange")
    }
    for (const field of ["starts_at", "ends_at"] as const) {
      if (values[field] !== "" && toOffsetIso(values[field]) === null) {
        fail(field, "dateInvalid")
      }
    }
    const starts = toOffsetIso(values.starts_at)
    const ends = toOffsetIso(values.ends_at)
    if (starts && ends && new Date(ends).getTime() <= new Date(starts).getTime()) {
      fail("ends_at", "datesOrder")
    }
  })

export type PopupValues = z.infer<typeof popupSchema>

/** A new pop-up of a type: the backend's `POPUP_DEFAULTS`. */
export function emptyValues(type: PopupType): PopupValues {
  return {
    name: "",
    type,
    is_active: false,
    title: "",
    body: "",
    image_url: "",
    image_alt: "",
    button_label: "",
    button_href: "",
    promotion_id: "",
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
    design: suggestedDesign(type),
    priority: 0,
    starts_at: "",
    ends_at: "",
  }
}

/**
 * The design a new pop-up of a type starts with: a campaign's code on a
 * ticket, the classic look otherwise. Any design suits any type.
 */
export function suggestedDesign(type: PopupType): PopupDesign {
  return type === "campaign" ? "coupon" : "classic"
}

/** A saved pop-up as the form shows it. */
export function valuesOf(popup: Popup): PopupValues {
  return {
    name: popup.name,
    type: popup.type,
    is_active: popup.is_active,
    title: popup.title,
    body: popup.body ?? "",
    image_url: popup.image_url ?? "",
    image_alt: popup.image_alt ?? "",
    button_label: popup.button_label ?? "",
    button_href: popup.button_href ?? "",
    promotion_id: popup.promotion_id ?? "",
    page_scope: popup.page_scope,
    pages: [...popup.pages],
    device: popup.device,
    visitor: popup.visitor,
    membership: popup.membership,
    trigger: popup.trigger,
    trigger_value: popup.trigger_value,
    frequency: popup.frequency,
    frequency_days: popup.frequency_days ?? 7,
    layout: popup.layout,
    design: popup.design,
    priority: popup.priority,
    starts_at: toLocalInput(popup.starts_at),
    ends_at: toLocalInput(popup.ends_at),
  }
}

/**
 * The fields a type leaves behind when the form moves to another: the
 * campaign's promotion, the link of a button that sends a form. With
 * `suggest` (a new pop-up whose design the owner has not touched), the
 * design follows the type's suggestion. The save
 * sends them empty too (`requestOf`); cleared here, the form shows it.
 */
export function switchType(
  values: PopupValues,
  type: PopupType,
  { suggest = false }: { suggest?: boolean } = {}
): PopupValues {
  // Only a design the owner has not chosen follows the type: the one the last type suggested
  const followDesign = suggest && values.design === suggestedDesign(values.type)
  return {
    ...values,
    type,
    design: followDesign ? suggestedDesign(type) : values.design,
    promotion_id: type === "campaign" ? values.promotion_id : "",
    button_href: type === "newsletter" ? "" : values.button_href,
  }
}

const orNull = (text: string): string | null => (text.trim() === "" ? null : text.trim())

/**
 * The body a save sends: every field, those the type or a choice does not
 * use sent empty (null), so nothing of an earlier type stays on the record.
 * `is_active` only for a new one: a saved one has its own switch.
 */
export function requestOf(values: PopupValues, { create }: { create: boolean }): PopupInput {
  const imageUrl = orNull(values.image_url)
  return {
    name: values.name.trim(),
    type: values.type,
    ...(create ? { is_active: values.is_active } : {}),
    title: values.title.trim(),
    body: orNull(values.body.replace(/\r\n?/g, "\n")),
    image_url: imageUrl,
    image_alt: imageUrl ? orNull(values.image_alt) : null,
    button_label: orNull(values.button_label),
    button_href: values.type === "newsletter" ? null : orNull(values.button_href),
    promotion_id: values.type === "campaign" ? orNull(values.promotion_id) : null,
    page_scope: values.page_scope,
    pages: values.page_scope === "selected" ? [...new Set(values.pages)] : [],
    device: values.device,
    visitor: values.visitor,
    membership: values.membership,
    trigger: values.trigger,
    trigger_value: values.trigger_value,
    frequency: values.frequency,
    frequency_days: values.frequency === "days" ? values.frequency_days : null,
    layout: values.layout,
    design: values.design,
    priority: values.priority,
    starts_at: toOffsetIso(values.starts_at),
    ends_at: toOffsetIso(values.ends_at),
  }
}

type FieldName = keyof PopupValues

/**
 * The backend's refusals (adr/0080 §5) by the field they belong to, so a
 * failed save puts its sentence under that field; the sentence is the
 * backend's own, in the panel's language (adr/0021).
 */
export const REFUSAL_FIELDS: Readonly<Record<string, FieldName>> = {
  "popups.promotion_required": "promotion_id",
  "popups.promotion_not_allowed": "promotion_id",
  "popups.promotion_unknown": "promotion_id",
  "popups.button_incomplete": "button_href",
  "popups.button_link_not_allowed": "button_href",
  "popups.link_invalid": "button_href",
  "popups.pages_required": "pages",
  "popups.trigger_value_invalid": "trigger_value",
  "popups.frequency_days_required": "frequency_days",
  "popups.dates_invalid": "ends_at",
  "popups.image_unknown": "image_url",
  "media.svg_logo_only": "image_url",
}

/** The field a refusal names, or null (`popups.text_invalid` names none: it says it on the toast). */
export function refusalField(error: unknown): FieldName | null {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === "string" ? (REFUSAL_FIELDS[code] ?? null) : null
}
