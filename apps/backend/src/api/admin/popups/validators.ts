import { z } from "@medusajs/framework/zod"
import { isSafeHref } from "../../../lib/content/doc"
import {
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
} from "../../../lib/popups/rules"
import { isCleanText } from "../../../lib/security"

// Invisible format characters (bidi overrides) make a line read as another
const FORMAT = /\p{Cf}/u

/** One line of plain text: no control or format characters; trimmed. */
const line = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((text) => isCleanText(text) && !FORMAT.test(text), { message: "popups.text_invalid" })

/** A few lines of plain text: line breaks kept (as `\n`), nothing else; trimmed. */
const lines = z
  .string()
  .transform((text) => text.replace(/\r\n?/g, "\n").trim())
  .refine((text) => text.length <= POPUP_LIMITS.body, { message: "popups.text_invalid" })
  .refine((text) => text.split("\n").length <= POPUP_LIMITS.bodyLines, {
    message: "popups.text_invalid",
  })
  .refine((text) => text.split("\n").every((each) => isCleanText(each) && !FORMAT.test(each)), {
    message: "popups.text_invalid",
  })

/** Empty text is no text. */
const orNull = <T extends z.ZodType<string>>(schema: T) =>
  schema
    .nullable()
    .transform((text) => (text === null || text === "" ? null : text))
    .optional()

const moment = z.iso
  .datetime({ offset: true })
  .transform((text) => new Date(text))
  .nullable()
  .optional()

const href = z
  .string()
  .trim()
  .max(POPUP_LIMITS.href)
  .refine((text) => text === "" || isSafeHref(text), { message: "popups.link_invalid" })

// Shape and size only; what the fields say together and the picture are the workflow's
const fields = {
  name: line(POPUP_LIMITS.name).pipe(z.string().min(1)),
  type: z.enum(POPUP_TYPES),
  is_active: z.boolean().optional(),
  starts_at: moment,
  ends_at: moment,
  priority: z.number().int().min(0).max(POPUP_LIMITS.priorityMax).optional(),
  title: line(POPUP_LIMITS.title).pipe(z.string().min(1)),
  body: orNull(lines),
  image_url: orNull(z.string().trim().max(POPUP_LIMITS.href)),
  image_alt: orNull(line(POPUP_LIMITS.imageAlt)),
  button_label: orNull(line(POPUP_LIMITS.buttonLabel)),
  button_href: orNull(href),
  promotion_id: orNull(z.string().trim().max(64)),
  page_scope: z.enum(POPUP_PAGE_SCOPES).optional(),
  pages: z.array(z.enum(POPUP_PAGES)).max(POPUP_PAGES.length).optional(),
  device: z.enum(POPUP_DEVICES).optional(),
  visitor: z.enum(POPUP_VISITORS).optional(),
  membership: z.enum(POPUP_MEMBERSHIPS).optional(),
  trigger: z.enum(POPUP_TRIGGERS).optional(),
  trigger_value: z.number().int().min(0).max(POPUP_LIMITS.delayMax).optional(),
  frequency: z.enum(POPUP_FREQUENCIES).optional(),
  frequency_days: z.number().int().min(1).max(POPUP_LIMITS.daysMax).nullable().optional(),
  layout: z.enum(POPUP_LAYOUTS).optional(),
}

/** A new pop-up: its name, type and title; the rest start from `POPUP_DEFAULTS`. */
export const AdminPostPopup = z.object(fields).strict()
export type AdminPostPopupType = z.infer<typeof AdminPostPopup>

/** A change: fields left out keep their values. */
export const AdminUpdatePopup = z
  .object({
    ...fields,
    name: fields.name.optional(),
    type: fields.type.optional(),
    title: fields.title.optional(),
  })
  .strict()
export type AdminUpdatePopupType = z.infer<typeof AdminUpdatePopup>

/** The list's switch. */
export const AdminPostPopupStatus = z.object({ is_active: z.boolean() }).strict()
export type AdminPostPopupStatusType = z.infer<typeof AdminPostPopupStatus>

/** `?q=&type=&offset=&limit=`: pop-ups by name, newest first. */
export const AdminGetPopups = z
  .object({
    q: z.string().trim().max(200).optional(),
    type: z.enum(POPUP_TYPES).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
export type AdminGetPopupsType = z.infer<typeof AdminGetPopups>
