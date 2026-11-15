import { MedusaService } from "@medusajs/framework/utils"
import { WholesaleAccount } from "./models/account"
import { WholesaleManualPrice } from "./models/manual-price"
import { WholesaleTier } from "./models/tier"

/** Whose list it is: a level's, or one wholesaler's own. */
export type WholesaleListKind = "level" | "private"

/** A price list the module writes, with what decides its rows (ADR-0068 §4). */
export interface WholesaleList {
  kind: WholesaleListKind
  /** The tier's or the account's id. */
  owner_id: string
  price_list_id: string
  customer_group_id: string
  rate_bps: number | null
  sync_requested_at: Date | null
  synced_at: Date | null
}

// A shop's levels and wholesalers fit one read each
const EVERY = { take: null } as const

const date = (value: Date | string | null | undefined): Date | null =>
  value ? new Date(value) : null

/**
 * Wholesale levels, accounts and hand-entered prices (ADR-0068). The
 * Medusa groups and price lists they own are named here, so the guards
 * on Medusa's own routes and the price writers ask one place.
 */
class WholesaleModuleService extends MedusaService({
  WholesaleTier,
  WholesaleAccount,
  WholesaleManualPrice,
}) {
  /**
   * Every list the module writes: the levels' and the wholesalers' own.
   * `withDeleted`: those of levels taken away too (their lists' events).
   */
  async wholesaleLists(options: { withDeleted?: boolean } = {}): Promise<WholesaleList[]> {
    const read = { ...EVERY, withDeleted: options.withDeleted === true }
    const [tiers, accounts] = await Promise.all([
      this.listWholesaleTiers({}, read),
      this.listWholesaleAccounts({ private_price_list_id: { $ne: null } }, read),
    ])
    return [
      ...tiers.map((tier): WholesaleList => ({
        kind: "level",
        owner_id: tier.id,
        price_list_id: tier.price_list_id,
        customer_group_id: tier.customer_group_id,
        rate_bps: tier.rate_bps ?? null,
        sync_requested_at: date(tier.sync_requested_at),
        synced_at: date(tier.synced_at),
      })),
      ...accounts.flatMap((account): WholesaleList[] =>
        account.private_price_list_id && account.private_group_id
          ? [
              {
                kind: "private",
                owner_id: account.id,
                price_list_id: account.private_price_list_id,
                customer_group_id: account.private_group_id,
                rate_bps: account.rate_bps ?? null,
                sync_requested_at: date(account.sync_requested_at),
                synced_at: date(account.synced_at),
              },
            ]
          : []
      ),
    ]
  }

  /** One list as it stands now, by its owner; null once the level or its list is gone. */
  async wholesaleList(
    list: Pick<WholesaleList, "kind" | "owner_id">
  ): Promise<WholesaleList | null> {
    const lists = await this.wholesaleLists()
    return lists.find((each) => each.kind === list.kind && each.owner_id === list.owner_id) ?? null
  }

  /** The Medusa price lists and customer groups no one writes but this module. */
  async ownedIds(
    options: { withDeleted?: boolean } = {}
  ): Promise<{ priceListIds: Set<string>; groupIds: Set<string> }> {
    const lists = await this.wholesaleLists(options)
    const accounts = await this.listWholesaleAccounts(
      { private_group_id: { $ne: null } },
      { select: ["private_group_id"], take: null, withDeleted: options.withDeleted === true }
    )
    return {
      priceListIds: new Set(lists.map((list) => list.price_list_id)),
      groupIds: new Set([
        ...lists.map((list) => list.customer_group_id),
        ...accounts.flatMap((account) => account.private_group_id ?? []),
      ]),
    }
  }

  /** Asks for a list to be written again; the sync job picks it up. */
  async requestSync(list: Pick<WholesaleList, "kind" | "owner_id">, at = new Date()) {
    if (list.kind === "level") {
      await this.updateWholesaleTiers({ id: list.owner_id, sync_requested_at: at })
    } else {
      await this.updateWholesaleAccounts({ id: list.owner_id, sync_requested_at: at })
    }
  }

  /** A full write that started at `started` covered every request made before it. */
  async recordSynced(list: Pick<WholesaleList, "kind" | "owner_id">, started: Date) {
    if (list.kind === "level") {
      await this.updateWholesaleTiers({ id: list.owner_id, synced_at: started })
    } else {
      await this.updateWholesaleAccounts({ id: list.owner_id, synced_at: started })
    }
  }
}

export default WholesaleModuleService
