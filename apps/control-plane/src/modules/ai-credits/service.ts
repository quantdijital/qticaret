import type { Context } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaError } from "@medusajs/framework/utils"
import { rowsOf } from "./sql"
import type { Executor } from "./sql"
import { AiCreditReads } from "./service-reads"

export { StaleWallet } from "./sql"
export type { AiCreditOrderRow, OrderPayment } from "./service-orders"
export type { AiCreditSettingRow, AiCreditSettingValues } from "./service-settings"
export type { AiCreditEntryView, Page } from "./service-reads"

/** A shop's ledger and wallet that do not agree (the reconcile job's finding). */
export interface LedgerMismatch {
  tenant_id: string
  wallet: { plan: number; purchased: number }
  ledger: { plan: number; purchased: number }
}

// No parameters: a call with the generated writer's arguments does not
// compile, and one that gets past the types still throws
function refuseWrite(): never {
  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.ai_credit_write_refused")
}

/**
 * The AI platform credits (adr/0085 §1): wallets, the append-only ledger,
 * the charged operations and the top-up requests. Every change goes
 * through the methods of the classes below it (service-wallet.ts,
 * service-grants.ts, service-operations.ts, service-closing.ts,
 * service-orders.ts, service-settings.ts), each one transaction with conditional statements;
 * the generated writers are closed.
 */
class AiCreditsModuleService extends AiCreditReads {
  /**
   * Every shop whose ledger does not add up to its wallet, bucket by
   * bucket. One statement, so one snapshot: a change commits its wallet and
   * its rows together and is seen whole or not at all.
   */
  @InjectManager()
  async ledgerMismatches(@MedusaContext() sharedContext: Context = {}): Promise<LedgerMismatch[]> {
    const rows = await rowsOf<{
      tenant_id: string
      // Text: a ledger's sum is a bigint, which the driver hands back as a string
      wallet_plan: string
      wallet_purchased: string
      ledger_plan: string
      ledger_purchased: string
    }>(
      sharedContext.manager as Executor,
      `WITH sums AS (
         SELECT tenant_id,
                COALESCE(SUM(amount) FILTER (WHERE bucket = 'plan'), 0)::bigint AS plan,
                COALESCE(SUM(amount) FILTER (WHERE bucket = 'purchased'), 0)::bigint AS purchased
           FROM ai_credit_entry WHERE deleted_at IS NULL GROUP BY tenant_id
       ), wallets AS (
         SELECT tenant_id, plan_balance, purchased_balance
           FROM ai_credit_wallet WHERE deleted_at IS NULL
       )
       SELECT COALESCE(w.tenant_id, s.tenant_id) AS tenant_id,
              COALESCE(w.plan_balance, 0)::text AS wallet_plan,
              COALESCE(w.purchased_balance, 0)::text AS wallet_purchased,
              COALESCE(s.plan, 0)::text AS ledger_plan,
              COALESCE(s.purchased, 0)::text AS ledger_purchased
         FROM wallets w FULL OUTER JOIN sums s ON s.tenant_id = w.tenant_id
        WHERE COALESCE(w.plan_balance, 0) <> COALESCE(s.plan, 0)
           OR COALESCE(w.purchased_balance, 0) <> COALESCE(s.purchased, 0)
        ORDER BY 1
        LIMIT 1000`,
      []
    )
    return rows.map((row) => ({
      tenant_id: row.tenant_id,
      wallet: { plan: Number(row.wallet_plan), purchased: Number(row.wallet_purchased) },
      ledger: { plan: Number(row.ledger_plan), purchased: Number(row.ledger_purchased) },
    }))
  }

  // The generated writers stay unreachable: balances and ledger rows change
  // only through the methods above, each with its conditions and rows
  override createAiCreditWallets = refuseWrite
  override updateAiCreditWallets = refuseWrite
  override deleteAiCreditWallets = refuseWrite
  override softDeleteAiCreditWallets = refuseWrite
  override restoreAiCreditWallets = refuseWrite
  override createAiCreditEntries = refuseWrite
  override updateAiCreditEntries = refuseWrite
  override deleteAiCreditEntries = refuseWrite
  override softDeleteAiCreditEntries = refuseWrite
  override restoreAiCreditEntries = refuseWrite
  override createAiCreditOperations = refuseWrite
  override updateAiCreditOperations = refuseWrite
  override deleteAiCreditOperations = refuseWrite
  override softDeleteAiCreditOperations = refuseWrite
  override restoreAiCreditOperations = refuseWrite
  override createAiCreditOrders = refuseWrite
  override updateAiCreditOrders = refuseWrite
  override deleteAiCreditOrders = refuseWrite
  override softDeleteAiCreditOrders = refuseWrite
  override restoreAiCreditOrders = refuseWrite
  override createAiCreditSettings = refuseWrite
  override updateAiCreditSettings = refuseWrite
  override deleteAiCreditSettings = refuseWrite
  override softDeleteAiCreditSettings = refuseWrite
  override restoreAiCreditSettings = refuseWrite
}

export default AiCreditsModuleService
