import type { Context } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaError, MedusaService } from "@medusajs/framework/utils"
import { BillingSetting } from "./models/billing-setting"
import { Charge } from "./models/charge"
import { Reminder } from "./models/reminder"
import { Subscription } from "./models/subscription"
import { CHARGE_FIELDS, SUBSCRIPTION_FIELDS } from "./types"
import type { ChargeRecord, SubscriptionRecord } from "./types"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

const notFound = (key: string) => new MedusaError(MedusaError.Types.NOT_FOUND, key)

/** Billing's reads (Ek C16): a shop's subscription, the subscriptions' ids, charges. */
export class BillingReads extends MedusaService({
  Subscription,
  Charge,
  Reminder,
  BillingSetting,
}) {
  @InjectManager()
  async subscriptionOf(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<SubscriptionRecord | null> {
    const [found] = await this.listSubscriptions(
      { tenant_id: tenantId },
      { select: [...SUBSCRIPTION_FIELDS], take: 1 },
      sharedContext
    )
    return (found as unknown as SubscriptionRecord | undefined) ?? null
  }

  /** Every subscription's id, oldest first, page by page (the job). */
  @InjectManager()
  async subscriptionIds(
    after: string,
    take: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string[]> {
    const rows = (await (sharedContext.manager as Executor).execute(
      `SELECT id FROM subscription WHERE deleted_at IS NULL AND id > ? ORDER BY id LIMIT ?`,
      [after, take]
    )) as { id: string }[]
    return rows.map((row) => row.id)
  }

  @InjectManager()
  async chargesOf(
    filter: { tenant_id?: string; subscription_id?: string; id?: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ChargeRecord[]> {
    return await this.listCharges(
      filter,
      { select: [...CHARGE_FIELDS], order: { due_on: "DESC", created_at: "DESC" }, take: 500 },
      sharedContext
    )
  }

  @InjectManager()
  async chargeOf(
    tenantId: string,
    chargeId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ChargeRecord> {
    const [found] = await this.chargesOf({ tenant_id: tenantId, id: chargeId }, sharedContext)
    if (!found) {
      throw notFound("cp.charge_unknown")
    }
    return found
  }
}
