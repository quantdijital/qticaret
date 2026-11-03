import { z } from "zod"
import { LINK_STATUSES } from "./api/types"

/** The list's URL: `/payment-links?status=open&discounted=true&created_by=user_1&page=2`. */
export const paymentLinkSearchSchema = z.object({
  status: z.enum(LINK_STATUSES).optional().catch(undefined),
  discounted: z.enum(["true", "false"]).optional().catch(undefined),
  created_by: z
    .string()
    .regex(/^[\w-]{1,64}$/)
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

export type PaymentLinkSearch = z.infer<typeof paymentLinkSearchSchema>

/** `/payment-links/new?from=plink_…`: "Yeniden oluştur", the form filled from that link. */
export const newPaymentLinkSearchSchema = z.object({
  from: z
    .string()
    .regex(/^plink_[0-9A-Za-z]{1,64}$/)
    .optional()
    .catch(undefined),
})

/** `/payment-links/:id?created=true`: just made, the share card says so. */
export const paymentLinkPageSearchSchema = z.object({
  created: z.boolean().optional().catch(undefined),
})
