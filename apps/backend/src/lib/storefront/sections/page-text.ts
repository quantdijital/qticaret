import { z } from "@medusajs/framework/zod"
import { contentDoc } from "../../content"
import { bodyFields } from "./look"
import { VARIANT_ERROR } from "./variants"

/**
 * A content page's own sections (adr/0073 Ek 2026-11-19 (2) K2), the
 * pages' only, each at most once on a page: `contact` ("İletişim"), the
 * contact page's body as it is drawn today (its text and the "Bize
 * ulaşın" stage beside the form, the shop's imprint below; their anchors
 * are the page's, so once); `payment_facts` ("Ödeme seçenekleri") and
 * `shipping_facts` ("Kargo bilgileri"), the live facts, no fields of their
 * own. A page's text sections are the rich texts (every variant) and
 * `contact`: their documents are the page's text (its `body` mirror).
 *
 * Mirrors `@qticaret/types`' `PAGE_ONLY_TYPES` and `CONTACT_SWITCHES`; a
 * unit test keeps them equal.
 */
export const PAGE_ONLY_TYPES = ["contact", "payment_facts", "shipping_facts"] as const

export const CONTACT_SWITCHES = ["on", "off"] as const

/** A switch off the list is a stale or forged editor. */
const contactSwitch = z
  .custom<(typeof CONTACT_SWITCHES)[number]>(
    (value) => (CONTACT_SWITCHES as readonly unknown[]).includes(value),
    VARIANT_ERROR
  )
  .default("on")

export const contact = z
  .object({
    ...bodyFields,
    type: z.literal("contact"),
    /** The section's own text, beside the form. */
    body: contentDoc,
    form: contactSwitch,
    imprint: contactSwitch,
  })
  .strict()

export const paymentFacts = z.object({ ...bodyFields, type: z.literal("payment_facts") }).strict()

export const shippingFacts = z.object({ ...bodyFields, type: z.literal("shipping_facts") }).strict()

export type ContactSection = z.infer<typeof contact>

/** Whether the type is a page's own, at most once on a page. */
export const isPageOnlyType = (type: string): boolean =>
  (PAGE_ONLY_TYPES as readonly string[]).includes(type)

/** Whether a page's own types each stand at most once among its sections. */
export const pageOnlyOnce = (sections: readonly { type: string }[]): boolean => {
  const own = sections.filter((section) => isPageOnlyType(section.type))
  return new Set(own.map((section) => section.type)).size === own.length
}
