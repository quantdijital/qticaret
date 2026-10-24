import CustomerModule from "@medusajs/medusa/customer"
import { defineLink } from "@medusajs/framework/utils"
import BillingProfileModule from "../modules/billing-profile"

/**
 * One billing profile per customer (adr/0009). Deleting the customer
 * deletes the profile too, so no tax id outlives its owner (KVKK).
 */
// Core module linkables are typed `any` by Medusa; the customer linkable exists at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineLink(CustomerModule.linkable["customer"], {
  linkable: BillingProfileModule.linkable.billingProfile,
  deleteCascade: true,
})
