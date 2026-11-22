import { z } from "zod"
import { CONTACT_STATUSES, CONTACT_SUBJECTS } from "./api/contact-messages"
import { CUSTOMER_KINDS } from "./api/customers"

/** The contact messages' URL: `/customers/contact-messages?status=handled&subject=booking&phone=0532…&page=2` (1-based). */
export const contactMessageSearchSchema = z.object({
  status: z.enum(CONTACT_STATUSES).optional().catch(undefined),
  subject: z.enum(CONTACT_SUBJECTS).optional().catch(undefined),
  phone: z.string().max(20).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

/** The carts left behind: `/customers/abandoned-carts?page=2` (1-based). */
export const abandonedCartSearchSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})

/** The customer list's URL: `/customers?kind=registered&q=ayse&page=2` (1-based in the URL). */
export const customerListSearchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  kind: z.enum(CUSTOMER_KINDS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
})
