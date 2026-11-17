import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { chunksOf } from "../../lib/catalog"
import { normalizeEmail } from "../../lib/wholesale"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { CUSTOMERS_WHOLESALE } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { wholesale } from "./steps/account-rows"

/**
 * Who marketing leaves out (ADR-0068 decision 16): a bulk campaign and a
 * cart reminder show retail prices and offers, so neither goes to a
 * wholesaler; transactional messages (an order's, a parcel's) are not
 * marketing and are unchanged. A wholesaler is an active account while
 * the shop has `customers.wholesale` on, as the storefront prices them
 * (`shopper.ts`): with the flag off, or once closed or deleted, they are
 * a retail customer and get marketing again.
 */

type Container = Pick<MedusaContainer, "resolve">

export interface Wholesalers {
  /** Their customer records. */
  customerIds: ReadonlySet<string>
  /** Their sign-in addresses, trimmed and lower case (`normalizeEmail`). */
  emails: ReadonlySet<string>
  /** Their phones as the customer record keeps them; hashed by the caller for its channel. */
  phones: readonly string[]
}

export const NO_WHOLESALERS: Wholesalers = Object.freeze({
  customerIds: new Set<string>(),
  emails: new Set<string>(),
  phones: [],
})

interface CustomerRow {
  id: string
  email: string | null
  phone: string | null
}

/** The shop's active wholesalers, read once per run: a shop's wholesalers fit one read. */
export async function activeWholesalers(container: Container): Promise<Wholesalers> {
  const enabled = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .isFeatureEnabled(CUSTOMERS_WHOLESALE)
  if (!enabled) {
    return NO_WHOLESALERS
  }
  const accounts = await wholesale(container).listWholesaleAccounts(
    { status: "active", customer_id: { $ne: null } },
    { select: ["customer_id"], take: null }
  )
  const ids = [...new Set(accounts.flatMap((account) => account.customer_id ?? []))]
  if (ids.length === 0) {
    return NO_WHOLESALERS
  }
  const customers = container.resolve(Modules.CUSTOMER)
  const rows: CustomerRow[] = []
  for (const chunk of chunksOf(ids)) {
    rows.push(
      ...((await customers.listCustomers(
        { id: chunk },
        { select: ["id", "email", "phone"], take: null }
      )) as CustomerRow[])
    )
  }
  return {
    customerIds: new Set(ids),
    emails: new Set(rows.flatMap((row) => (row.email ? [normalizeEmail(row.email)] : []))),
    phones: rows.flatMap((row) => (row.phone ? [row.phone] : [])),
  }
}

/** Whether a cart is a wholesaler's: by its customer, or by its address (one signed out). */
export function isWholesalersCart(
  wholesalers: Wholesalers,
  cart: { customer_id?: string | null; email?: string | null }
): boolean {
  if (cart.customer_id && wholesalers.customerIds.has(cart.customer_id)) {
    return true
  }
  return cart.email ? wholesalers.emails.has(normalizeEmail(cart.email)) : false
}
