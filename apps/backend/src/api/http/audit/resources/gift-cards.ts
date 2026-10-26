import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { AuditedResource, GraphQuery, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Gift cards and store credit (F4.8, ADR-0025): money a customer holds at
 * the shop. A credit or debit is recorded with the account's balance before
 * and after; a card's making and update with its value, status, end date
 * and what it has left. The code, which spends the card, is never written.
 * A new card is found by the code `giftCardCodes` wrote into the body.
 */

type When = string | Date | null | undefined

interface AccountRow {
  currency_code?: string | null
  balance?: unknown
  credits?: unknown
  debits?: unknown
}

interface GiftCardRow {
  id?: string | null
  status?: string | null
  value?: unknown
  expires_at?: When
  store_credit_account?: AccountRow | null
}

const graph = (scope: Resolver) => scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery
// Amounts come back as numbers (or numeric strings); anything else is left out
const amount = (value: unknown): string | null =>
  typeof value === "number" || typeof value === "string" ? String(value) : null

async function accountSnapshot(scope: Resolver, id: string): Promise<Snapshot> {
  const { data } = await graph(scope).graph({
    entity: "store_credit_account",
    fields: ["currency_code", "balance", "credits", "debits"],
    filters: { id },
  })
  const row = data[0] as AccountRow | undefined
  if (!row) {
    return {}
  }
  return {
    currency_code: row.currency_code ?? null,
    balance: amount(row.balance),
    credits: amount(row.credits),
    debits: amount(row.debits),
  }
}

async function giftCardSnapshot(
  scope: Resolver,
  filters: { id: string } | { code: string }
): Promise<Snapshot> {
  const { data } = await graph(scope).graph({
    entity: "gift_card",
    fields: [
      "id",
      "status",
      "value",
      "currency_code",
      "expires_at",
      "store_credit_account.balance",
    ],
    filters,
  })
  const row = data[0] as (GiftCardRow & { currency_code?: string | null }) | undefined
  if (!row) {
    return {}
  }
  return {
    id: row.id ?? null,
    currency_code: row.currency_code ?? null,
    status: row.status ?? null,
    value: amount(row.value),
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    balance: amount(row.store_credit_account?.balance),
  }
}

const accountMovement = (movement: "credit" | "debit"): AuditedResource => ({
  method: "POST",
  route: `POST /admin/store-credit-accounts/:id/${movement}`,
  pattern: new RegExp(`^/admin/store-credit-accounts/(?<id>${ID})/${movement}$`, "i"),
  resourceType: "store_credit_account",
  resourceId: (params) => params["id"] ?? null,
  snapshot: ({ scope, params }) => accountSnapshot(scope, params["id"] ?? ""),
})

// Before the code is written the card does not exist yet: an empty snapshot
const newCard = (scope: Resolver, body: unknown): Promise<Snapshot> => {
  const code = (body as { code?: unknown } | undefined)?.code
  return typeof code === "string" ? giftCardSnapshot(scope, { code }) : Promise.resolve({})
}

export const GIFT_CARD_RESOURCES: readonly AuditedResource[] = [
  accountMovement("credit"),
  accountMovement("debit"),
  {
    method: "POST",
    route: "POST /admin/gift-cards",
    pattern: /^\/admin\/gift-cards$/i,
    resourceType: "gift_card",
    resourceId: () => null,
    snapshot: ({ scope, body }) => newCard(scope, body),
  },
  {
    method: "POST",
    route: "POST /admin/gift-cards/:id",
    pattern: new RegExp(`^/admin/gift-cards/(?<id>${ID})$`, "i"),
    resourceType: "gift_card",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => giftCardSnapshot(scope, { id: params["id"] ?? "" }),
  },
]
