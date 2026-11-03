import { z } from "@medusajs/framework/zod"
import {
  MAX_DISCOUNT_PERCENT,
  MAX_LINES,
  MAX_QUANTITY,
  PAYMENT_LINK_STATUSES,
} from "../../../lib/payment-links/snapshot"
import {
  DEFAULT_LINK_HOURS,
  MAX_LINK_HOURS,
  MIN_LINK_HOURS,
} from "../../../lib/payment-links/token"

const text = (max: number) => z.string().trim().min(1).max(max)

/**
 * What staff send to make a link (adr/0051 §2): variants and quantities,
 * never a price; strict, so a `unit_price` is refused rather than dropped.
 */
const line = z
  .object({
    variant_id: z.string().regex(/^variant_[0-9A-Z]{20,40}$/),
    quantity: z.number().int().min(1).max(MAX_QUANTITY),
  })
  .strict()

const discount = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("percentage"),
      value: z.number().int().min(1).max(MAX_DISCOUNT_PERCENT),
      reason: text(200),
    })
    .strict(),
  z
    .object({
      type: z.literal("fixed"),
      // Kuruş
      value: z.number().int().min(1).max(100_000_000),
      reason: text(200),
    })
    .strict(),
])

const contact = z
  .object({
    first_name: text(60),
    last_name: text(60),
    email: z.email().max(100),
    phone: z.string().trim().max(20).nullish(),
  })
  .strict()

/** A delivery address in the storefront's Turkish fields: province is the il, city the ilçe. */
const address = z
  .object({
    first_name: text(60),
    last_name: text(60),
    phone: z.string().trim().max(20).nullish(),
    address_1: text(200),
    address_2: z.string().trim().max(200).nullish(),
    city: text(60),
    province: text(60),
    postal_code: z.string().trim().max(10).nullish(),
    country_code: z.literal("tr").default("tr"),
  })
  .strict()

const planFields = {
  customer_id: z
    .string()
    .regex(/^cus_[0-9A-Z]{20,40}$/)
    .nullish(),
  lines: z.array(line).min(1).max(MAX_LINES),
  discount: discount.nullish(),
  shipping_option_id: z
    .string()
    .regex(/^so_[0-9A-Z]{20,40}$/)
    .nullish(),
}

/** The form as it stands; the address only lets the preset option's shipping be priced. */
export const AdminPreviewPaymentLink = z
  .object({ ...planFields, address: address.nullish() })
  .strict()
export type AdminPreviewPaymentLinkType = z.infer<typeof AdminPreviewPaymentLink>

export const AdminPostPaymentLink = z
  .object({
    ...planFields,
    guest: contact.nullish(),
    address: address.nullish(),
    note: z.string().trim().max(1000).nullish(),
    expires_in_hours: z
      .number()
      .int()
      .min(MIN_LINK_HOURS)
      .max(MAX_LINK_HOURS)
      .default(DEFAULT_LINK_HOURS),
  })
  .strict()
  .refine((body) => Boolean(body.customer_id) !== Boolean(body.guest), {
    message: "payment_link.customer_required",
    path: ["guest"],
  })
  .refine((body) => !body.shipping_option_id || body.address, {
    message: "payment_link.address_required",
    path: ["address"],
  })
export type AdminPostPaymentLinkType = z.infer<typeof AdminPostPaymentLink>

export const AdminGetPaymentLinks = z
  .object({
    status: z.enum(PAYMENT_LINK_STATUSES).optional(),
    /** "İndirimli bağlantılar" (adr/0051 §10): only those with a discount. */
    discounted: z.enum(["true", "false"]).optional(),
    created_by: z.string().max(64).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict()
export type AdminGetPaymentLinksType = z.infer<typeof AdminGetPaymentLinks>

export const AdminExtendPaymentLink = z
  .object({ hours: z.number().int().min(MIN_LINK_HOURS).max(MAX_LINK_HOURS) })
  .strict()
export type AdminExtendPaymentLinkType = z.infer<typeof AdminExtendPaymentLink>

export const AdminResendPaymentLink = z
  .object({
    channels: z
      .array(z.enum(["email", "sms"]))
      .min(1)
      .max(2),
  })
  .strict()
export type AdminResendPaymentLinkType = z.infer<typeof AdminResendPaymentLink>

/** Cancel takes nothing but the link's id. */
export const AdminPaymentLinkAction = z.object({}).strict()
