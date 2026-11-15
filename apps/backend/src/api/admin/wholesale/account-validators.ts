import { z } from "@medusajs/framework/zod"
import { detectTaxIdKind } from "@qticaret/server-kit"
import { minQuantity, percent } from "./validators"

/**
 * Wholesalers' bodies (ADR-0068 §3). The account's Medusa group and list
 * are never named here: the routes take the account's id, the module
 * finds the rest (§9, IDOR). No password: the wholesaler sets it on the
 * storefront.
 */

const email = z.string().trim().toLowerCase().max(254).pipe(z.email())
const companyName = z.string().trim().min(1).max(200)
const contactName = z.string().trim().min(2).max(100)
const tierId = z.string().trim().min(1).max(100)
// Spaces are common when typing long numbers; the rest must be digits
const taxId = z
  .string()
  .max(32)
  .transform((value) => value.replace(/\s+/g, ""))

/** A new wholesaler: the address, the contact, and a level and/or prices of their own. */
export const AdminPostWholesaleAccount = z
  .object({
    email,
    contact_name: contactName,
    company_name: companyName.nullable().default(null),
    /** Both or neither; written to the customer's invoice identity if they have an account (adr/0009). */
    tax_office: z.string().trim().min(2).max(100).optional(),
    tax_id: taxId.optional(),
    tier_id: tierId.nullable().default(null),
    own_prices: z.boolean().default(false),
    /** The own list's rate; opens the list. */
    percent: percent.nullable().default(null),
    min_quantity: minQuantity.nullable().default(null),
  })
  .strict()
  .superRefine((body, ctx) => {
    if ((body.tax_office === undefined) !== (body.tax_id === undefined)) {
      ctx.addIssue({ code: "custom", path: ["tax_id"], message: "wholesale.tax_pair" })
    }
    if (body.tax_id !== undefined && !detectTaxIdKind(body.tax_id)) {
      ctx.addIssue({ code: "custom", path: ["tax_id"], message: "billing_profile.tax_id_invalid" })
    }
    if (body.tax_id !== undefined && body.company_name === null) {
      ctx.addIssue({ code: "custom", path: ["company_name"], message: "wholesale.company_for_tax" })
    }
    if (body.tier_id === null && !body.own_prices && body.percent === null) {
      ctx.addIssue({ code: "custom", path: ["tier_id"], message: "wholesale.no_price_source" })
    }
  })
export type AdminPostWholesaleAccountType = z.infer<typeof AdminPostWholesaleAccount>

/** A wholesaler changed: null takes a level, a rate, a minimum or a name away. */
export const AdminUpdateWholesaleAccount = z
  .object({
    tier_id: tierId.nullable().optional(),
    /** Opens the wholesaler's own list; it is not closed by this route. */
    own_prices: z.literal(true).optional(),
    percent: percent.nullable().optional(),
    min_quantity: minQuantity.nullable().optional(),
    company_name: companyName.nullable().optional(),
    contact_name: contactName.nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0)
export type AdminUpdateWholesaleAccountType = z.infer<typeof AdminUpdateWholesaleAccount>

/** A state change or a resend takes no body: anything sent is refused. */
export const AdminPostWholesaleAccountAction = z.object({}).strict()

/** A page of the shop's wholesalers, newest first; `q` finds by address, company or name. */
export const AdminGetWholesaleAccounts = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
    q: z.string().trim().max(100).optional(),
    status: z.enum(["pending", "active", "inactive"]).optional(),
  })
  .strict()
export type AdminGetWholesaleAccountsType = z.infer<typeof AdminGetWholesaleAccounts>
