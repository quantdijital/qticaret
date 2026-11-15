/**
 * The wholesale screens' shapes (ADR-0068), as `/admin/wholesale/*`
 * answers them (`apps/backend/src/api/admin/wholesale/view.ts`,
 * `account-view.ts`). Amounts are exact lira strings ("1250.50"); dates
 * ISO strings. No Medusa group or list id ever comes out (§9).
 */

/** The shop flag that turns the whole thing on (ADR-0068 §9, adr/0012). */
export const WHOLESALE_FLAG = "customers.wholesale"

export const ACCOUNT_STATUSES = ["pending", "active", "inactive"] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

/** A wholesale level: a group and its price list, a rate off every variant and a minimum. */
export interface WholesaleTier {
  id: string
  name: string
  /** Off every variant's own price, two decimals; null: hand-entered prices only. */
  percent: number | null
  min_quantity: number | null
  /** The rate's rows are still being written: a quiet "fiyatlar güncelleniyor". */
  sync_pending: boolean
  synced_at: string | null
  created_at: string
}

/** A wholesaler as the panel reads it: names from the customer record once bound. */
export interface WholesaleAccount {
  id: string
  status: AccountStatus
  email: string | null
  company_name: string | null
  contact_name: string | null
  customer: { id: string; email: string | null } | null
  tier: { id: string; name: string } | null
  /** Whether the wholesaler has a price list of its own. */
  own_prices: boolean
  /** The own list's rate; null without one. */
  percent: number | null
  min_quantity: number | null
  sync_pending: boolean
  invited_at: string | null
  invitation_expires_at: string | null
  /** While pending: how many times the invitation went out, the first counted. */
  invitations_sent: number | null
  activated_at: string | null
  deactivated_at: string | null
  created_at: string
}

export interface Page {
  count: number
  limit: number
  offset: number
}

export interface AccountsPage extends Page {
  accounts: WholesaleAccount[]
}

export interface TiersPage extends Page {
  tiers: WholesaleTier[]
}

/** One variant on a wholesale list. */
export interface WholesaleLine {
  variant_id: string
  variant_title: string | null
  sku: string | null
  product_id: string
  product_title: string
  thumbnail: string | null
  /** KDV excluded: entered by hand, or worked out from the row. */
  net: string
  /** KDV included: what Medusa prices with; shown for information. */
  gross: string
  vat_bps: number
  vat_percent: number
  source: "manual" | "rate"
  /** The variant's own price, KDV included. */
  base: string | null
  /** What a shopper with no group pays now, a live public sale included. */
  retail_now: string | null
  /** Retail now is below the wholesale price: a warning, never a block. */
  undercut: boolean
}

export interface LinesPage extends Page {
  lines: WholesaleLine[]
  /** Of all the lines the search finds, the ones retail undercuts. */
  undercut_count: number
  /** Variants the rate would sell at 0,00: no row, they keep retail (at most 20 named). */
  rate_zero: { count: number; variant_ids: string[] }
}

/** How the new wholesaler's e-mail went. */
export type MessageOutcome = "sent" | "not_sent"

/** Whether the typed tax details reached the customer's invoice identity. */
export type BillingOutcome = "written" | "kept" | "none"

export interface CreatedAccount {
  account: WholesaleAccount
  message: MessageOutcome
  billing_profile: BillingOutcome
}

/** Open carts priced again after a state change; `failed` is a warning. */
export interface CartsRepriced {
  repriced: number
  failed: number
}

/** `POST /admin/wholesale/accounts`'s body. */
export interface CreateAccountBody {
  email: string
  contact_name: string
  company_name: string | null
  tax_office?: string
  tax_id?: string
  tier_id: string | null
  own_prices: boolean
  percent: number | null
  min_quantity: number | null
}

/** `POST /admin/wholesale/accounts/:id`'s body: only what changed. */
export interface UpdateAccountBody {
  tier_id?: string | null
  own_prices?: true
  percent?: number | null
  min_quantity?: number | null
  company_name?: string | null
  contact_name?: string | null
}

export interface TierBody {
  name: string
  percent: number | null
  min_quantity: number | null
}

/** Whose list a price line card shows: a level's or a wholesaler's own. */
export interface ListOwner {
  kind: "tier" | "account"
  id: string
}

/** Hand-entered prices, KDV excluded, at most 100 changes a request. */
export interface PricesBody {
  set?: { variant_id: string; net: string }[]
  remove?: string[]
}
