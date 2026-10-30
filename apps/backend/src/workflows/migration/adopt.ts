import type { ICustomerModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { likeLiteral } from "../../lib/db/like"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"

interface Moved {
  id: string
  customer_id: string | null
}

interface Undo {
  account: string
  legacy: Moved[]
  reviews: Moved[]
  consents: Moved[]
  addresses: string[]
  items: string[]
}

// What an account copies of a moved record's addresses at most
const MAX_ADDRESSES = 20

const ADDRESS_FIELDS = [
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "country_code",
  "phone",
] as const

/**
 * A signed-in customer's own moved record (F14.5, adr/0042 §5): the
 * customer the migration made with their address, as a guest, gives the
 * account what moved with it: the old platform's orders, the reviews (but
 * one of a product the account reviewed itself), the consents, and the
 * addresses when the account has none. Signing in proved the address, as
 * for guest orders (adr/0037 §1). Done once per moved record.
 */
export const adoptMigratedStep = createStep(
  "migration-adopt-moved-customer",
  async (input: { customer_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "has_account"],
      filters: { id: input.customer_id },
    })
    const account = data[0] as { email: string | null; has_account: boolean } | undefined
    if (!account?.has_account || !account.email) {
      return new StepResponse(null)
    }
    const customers = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
    const guests = await customers.listCustomers(
      { email: { $ilike: likeLiteral(account.email) }, has_account: false },
      { select: ["id"] }
    )
    const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
    const items = guests.length
      ? await migration.listMigrationItems(
          {
            kind: "customer",
            status: "done",
            target_id: guests.map((guest) => guest.id),
            adopted_at: null,
          },
          { select: ["id", "target_id"] }
        )
      : []
    if (items.length === 0) {
      return new StepResponse(null)
    }
    const from = items.map((item) => item.target_id ?? "")
    const to = input.customer_id
    const reviews = container.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
    const [legacy, written, consents, own] = await Promise.all([
      migration.listLegacyOrders({ customer_id: from }, { select: ["id", "customer_id"] }),
      reviews.listProductReviews(
        { customer_id: from },
        { select: ["id", "customer_id", "product_id"] }
      ),
      messaging.listMessageConsents({ customer_id: from }, { select: ["id", "customer_id"] }),
      customers.listCustomerAddresses({ customer_id: to }, { select: ["id"], take: 1 }),
    ])
    const reviewed = new Set(
      (
        await reviews.listProductReviews(
          { customer_id: to, product_id: written.map((review) => review.product_id) },
          { select: ["product_id"] }
        )
      ).map((review) => review.product_id)
    )
    const movable = written.filter((review) => !reviewed.has(review.product_id))
    if (legacy.length > 0) {
      await migration.updateLegacyOrders(legacy.map(({ id }) => ({ id, customer_id: to })))
    }
    if (movable.length > 0) {
      await reviews.updateProductReviews(movable.map(({ id }) => ({ id, customer_id: to })))
    }
    if (consents.length > 0) {
      await messaging.updateMessageConsents(consents.map(({ id }) => ({ id, customer_id: to })))
    }
    let addresses: string[] = []
    if (own.length === 0) {
      const theirs = await customers.listCustomerAddresses(
        { customer_id: from },
        { select: [...ADDRESS_FIELDS], take: MAX_ADDRESSES }
      )
      if (theirs.length > 0) {
        const made = await customers.createCustomerAddresses(
          theirs.map((address) => ({
            customer_id: to,
            ...Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, address[field] ?? null])),
          }))
        )
        addresses = made.map((address) => address.id)
      }
    }
    const now = new Date()
    await migration.updateMigrationItems(items.map(({ id }) => ({ id, adopted_at: now })))
    const undo: Undo = {
      account: to,
      legacy: legacy.map(({ id, customer_id }) => ({ id, customer_id })),
      reviews: movable.map(({ id, customer_id }) => ({ id, customer_id })),
      consents: consents.map(({ id, customer_id }) => ({ id, customer_id })),
      addresses,
      items: items.map(({ id }) => id),
    }
    return new StepResponse(
      { orders: legacy.length, reviews: movable.length, addresses: addresses.length },
      undo
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
    if (undo.legacy.length > 0) {
      await migration.updateLegacyOrders(undo.legacy)
    }
    if (undo.reviews.length > 0) {
      await container
        .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
        .updateProductReviews(undo.reviews)
    }
    if (undo.consents.length > 0) {
      await container
        .resolve<MessagingModuleService>(MESSAGING_MODULE)
        .updateMessageConsents(undo.consents)
    }
    if (undo.addresses.length > 0) {
      await container
        .resolve<ICustomerModuleService>(Modules.CUSTOMER)
        .deleteCustomerAddresses(undo.addresses)
    }
    await migration.updateMigrationItems(undo.items.map((id) => ({ id, adopted_at: null })))
  }
)
