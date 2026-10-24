import CustomerModule from "@medusajs/medusa/customer"
import { defineLink } from "@medusajs/framework/utils"
import BillingProfileModule from "../modules/billing-profile"

/**
 * One billing profile per customer (adr/0009). deleteCascade covers flows
 * that remove the customer's links; Medusa's customer deletion does not, so
 * src/workflows/hooks/delete-customer-billing-profile.ts deletes the profile
 * there. A hard purge of soft-deleted profiles is a KVKK task for F13.
 */
// Core module linkables are typed `any` by Medusa; the customer linkable exists at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineLink(CustomerModule.linkable["customer"], {
  linkable: BillingProfileModule.linkable.billingProfile,
  deleteCascade: true,
})
