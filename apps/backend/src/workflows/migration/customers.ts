import type { ICustomerModuleService, MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { isValidationError } from "../../lib/errors"
import type {
  SourceAddress,
  SourceCustomer,
  SourceOrder,
  StepProblem,
  StepProgress,
} from "../../lib/migration/types"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"

type Container = Pick<MedusaContainer, "resolve">

// A plain e-mail shape: the platform's own forms are stricter, a migration only weeds out junk
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/
const BATCH = 100

const emailKey = (email: string) => email.trim().toLowerCase()

const addressOf = (address: SourceAddress) => ({
  first_name: address.first_name,
  last_name: address.last_name,
  company: address.company,
  address_1: address.address_1,
  address_2: address.address_2,
  city: address.city,
  province: address.province,
  postal_code: address.postal_code,
  phone: address.phone,
  country_code: "tr",
})

export interface CustomerCounts {
  read: number
  created: number
  found: number
  skipped: number
  /** Consents to commercial messages kept, per channel given. */
  consents: number
}

/**
 * Consent the old platform recorded with its date (adr/0042 §5), kept as
 * given then, from the import: only for an address with no answer here (a
 * newer one, a withdrawal, wins); İYS hears of it as of any consent. One
 * without a date is not consent, and an address the platform cannot take
 * keeps none. How many were kept.
 */
async function keepConsents(
  container: Container,
  source: string,
  customers: readonly SourceCustomer[],
  ids: ReadonlyMap<string, string>
): Promise<number> {
  const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
  const now = Date.now()
  let kept = 0
  for (const customer of customers) {
    const given = [
      ["email", customer.marketing?.email ?? null, customer.email] as const,
      ["sms", customer.marketing?.sms ?? null, customer.phone] as const,
    ]
    for (const [channel, at, address] of given) {
      if (!at || !address || at.getTime() > now) {
        continue
      }
      try {
        const { changed } = await messaging.recordConsent({
          channel,
          address,
          status: "granted",
          source: "import",
          customer_id: ids.get(emailKey(customer.email)) ?? null,
          given_at: at,
          only_new: true,
          evidence: { origin: "migration", source },
        })
        kept += changed ? 1 : 0
      } catch (error) {
        if (!isValidationError(error)) {
          throw error
        }
      }
    }
  }
  return kept
}

/**
 * The source's customers here (F14, adr/0042 §5): one whose e-mail the
 * shop knows already is left as it is (its live data wins); the rest made
 * without a password (they set one through the invitation, F14.5).
 * Consent to commercial messages only as the source dated it, never made
 * up. A dry run counts. The e-mails to customer ids, for their old orders.
 */
export async function migrateCustomers(
  container: Container,
  source: string,
  customers: readonly SourceCustomer[],
  apply: boolean,
  progress: StepProgress
): Promise<{ counts: CustomerCounts; ids: Map<string, string>; problems: StepProblem[] }> {
  const service = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  const counts: CustomerCounts = {
    read: customers.length,
    created: 0,
    found: 0,
    skipped: 0,
    consents: 0,
  }
  const ids = new Map<string, string>()
  const skipped: string[] = []
  const unique = new Map<string, SourceCustomer>()
  for (const customer of customers) {
    if (!EMAIL.test(customer.email.trim())) {
      skipped.push(customer.source_key)
      continue
    }
    unique.set(emailKey(customer.email), customer)
  }
  counts.skipped = skipped.length
  const all = [...unique.values()]
  for (let start = 0; start < all.length; start += BATCH) {
    const batch = all.slice(start, start + BATCH)
    const known = await service.listCustomers(
      { email: batch.map((customer) => emailKey(customer.email)) },
      { select: ["id", "email"], take: null }
    )
    for (const row of known) {
      ids.set(emailKey(row.email), row.id)
    }
    const fresh = batch.filter((customer) => !ids.has(emailKey(customer.email)))
    counts.found += batch.length - fresh.length
    if (!apply) {
      counts.created += fresh.length
    } else if (fresh.length > 0) {
      const { result } = await createCustomersWorkflow(container as MedusaContainer).run({
        input: {
          customersData: fresh.map((customer) => ({
            email: emailKey(customer.email),
            first_name: customer.first_name,
            last_name: customer.last_name,
            phone: customer.phone,
            addresses: customer.addresses.map(addressOf),
          })),
        },
      })
      for (const made of result) {
        ids.set(emailKey(made.email), made.id)
      }
      counts.created += result.length
    }
    if (apply) {
      counts.consents += await keepConsents(container, source, batch, ids)
    } else {
      // At most: an address with an answer here keeps its own
      for (const customer of batch) {
        counts.consents += Number(Boolean(customer.marketing?.email))
        counts.consents += Number(Boolean(customer.marketing?.sms && customer.phone))
      }
    }
    await progress(start + batch.length, all.length)
  }
  if (apply) {
    await container.resolve<MigrationModuleService>(MIGRATION_MODULE).remember(source, "customer", [
      ...[...unique.values()].map((customer) => {
        const id = ids.get(emailKey(customer.email)) ?? null
        return {
          source_key: customer.source_key,
          target_id: id,
          status: id ? ("done" as const) : ("failed" as const),
        }
      }),
      ...skipped.map((key) => ({
        source_key: key,
        target_id: null,
        status: "skipped" as const,
        error_code: "migration.email_invalid",
      })),
    ])
  }
  return {
    counts,
    ids,
    problems: skipped.map((key) => ({ source_key: key, key: "migration.email_invalid" })),
  }
}

/**
 * The source's orders as orders of the old platform (adr/0042 §4), each
 * to its customer by e-mail; never live orders here. Kept once: a run
 * again adds only the ones it had not kept. How many were added (would
 * be, in a dry run).
 */
export async function migrateOrders(
  container: Container,
  source: string,
  orders: readonly SourceOrder[],
  customerIds: ReadonlyMap<string, string>,
  apply: boolean,
  progress: StepProgress
): Promise<{ read: number; added: number }> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  let added = 0
  for (let start = 0; start < orders.length; start += BATCH) {
    const batch = orders.slice(start, start + BATCH)
    const kept = await migration.keptLegacyOrders(
      source,
      batch.map((order) => order.source_key)
    )
    const fresh = batch.filter((order) => !kept.has(order.source_key))
    added += fresh.length
    if (apply && fresh.length > 0) {
      await migration.addLegacyOrders(
        source,
        fresh.map((order) => ({
          source_key: order.source_key,
          number: order.number,
          placed_at: order.created_at,
          currency_code: order.currency,
          total: order.total,
          status: order.status,
          customer_id: order.customer_email
            ? (customerIds.get(emailKey(order.customer_email)) ?? null)
            : null,
          email: order.customer_email ? emailKey(order.customer_email) : null,
          lines: order.lines,
        }))
      )
    }
    await progress(Math.min(start + BATCH, orders.length), orders.length)
  }
  return { read: orders.length, added }
}
