import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
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

/** Rows read at a time. */
const PAGE = 1_000

interface PhoneRow {
  phone?: string | null
  addresses?: { phone?: string | null }[] | null
  shipping_address?: { phone?: string | null } | null
  billing_address?: { phone?: string | null } | null
}

const phonesOf = (row: PhoneRow) =>
  [
    row.phone,
    ...(row.addresses ?? []).map((address) => address.phone),
    row.shipping_address?.phone,
    row.billing_address?.phone,
  ].flatMap((phone) => (phone?.trim() ? [phone] : []))

/**
 * Every phone a wholesaler is known by (ADR-0068 slice 5 review L4): their
 * record's, their address book's and their orders' (shipping and billing),
 * the orders placed signed in and those placed signed out under their
 * address. A text campaign leaves these out wherever they turn up: a guest
 * order's consent, an imported list's. As written: the caller hashes them
 * for the channel (`recipientOf`, E.164). Read for a text campaign only: a
 * cart reminder and an e-mail campaign go by record and address.
 */
export async function wholesalersPhones(
  container: Container,
  wholesalers: Wholesalers
): Promise<string[]> {
  const ids = [...wholesalers.customerIds]
  const emails = [...wholesalers.emails]
  if (ids.length === 0) {
    return []
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const readAll = async (entity: string, fields: string[], filters: Record<string, unknown>) => {
    const rows: PhoneRow[] = []
    for (let skip = 0; ; skip += PAGE) {
      const { data } = await query.graph({
        entity,
        fields,
        filters,
        pagination: { skip, take: PAGE, order: { id: "ASC" } },
      })
      rows.push(...(data as PhoneRow[]))
      if (data.length < PAGE) {
        return rows
      }
    }
  }
  const orderFields = ["id", "shipping_address.phone", "billing_address.phone"]
  const rows: PhoneRow[] = []
  for (const chunk of chunksOf(ids)) {
    rows.push(
      ...(await readAll("customer", ["id", "phone", "addresses.phone"], { id: chunk })),
      ...(await readAll("order", orderFields, { customer_id: chunk }))
    )
  }
  const signedOut = await orderIdsByEmail(container, emails)
  for (const chunk of chunksOf(signedOut)) {
    rows.push(...(await readAll("order", orderFields, { id: chunk })))
  }
  return [...new Set(rows.flatMap(phonesOf))]
}

/**
 * The orders placed under these addresses (lower case, `normalizeEmail`),
 * however the shopper typed theirs: an order keeps its e-mail as typed
 * ("Ali@Firma.com"), and Medusa's filters match it exactly (review of L4).
 */
async function orderIdsByEmail(container: Container, emails: string[]): Promise<string[]> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const ids: string[] = []
  for (const chunk of chunksOf(emails)) {
    const found = await knex<{ id: string }>("order")
      .select("id")
      .whereNull("deleted_at")
      .whereRaw(`lower(btrim(email)) in (${chunk.map(() => "?").join(", ")})`, chunk)
    ids.push(...found.map((row) => row.id))
  }
  return ids
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
