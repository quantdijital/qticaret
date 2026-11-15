import CustomerModule from "@medusajs/medusa/customer"
import { defineLink } from "@medusajs/framework/utils"
import WholesaleModule from "../modules/wholesale"

/**
 * A customer's wholesale record (ADR-0068 §1), for the panel's lists to
 * read customers with it. The account also keeps `customer_id` itself:
 * the record is the source, the link its query path. Erasure removes the
 * account in its own step (slice 1b), so the link does not cascade.
 */
export default defineLink(
  // Core module linkables are typed `any` by Medusa; the customer linkable exists at runtime.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  CustomerModule.linkable["customer"],
  WholesaleModule.linkable.wholesaleAccount
)
