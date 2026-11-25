import type { MedusaContainer } from "@medusajs/framework/types"
import type { AiCreditPack, PaymentMethod } from "@qticaret/types/control-plane"
import { CP_AUDIT_MODULE } from "../../modules/cp-audit"
import type CpAuditModuleService from "../../modules/cp-audit/service"
import type { AiCreditBucket } from "../../modules/ai-credits/models/entry"
import type { AiCreditOrderRow } from "../../modules/ai-credits/service"
import { aiCreditsIn } from "../../workflows/modules"
import { withCurrentMonth } from "./rollover"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Bought credits added once per `grantRef` (adr/0085 K6, K11): a second
 * call with the same reference, also at the same time, changes nothing
 * and says so (`applied: false`). The whole bought balance then lasts the
 * lifetime from now (`AI_PURCHASED_LIFETIME_MONTHS`).
 */
export async function grantPurchase(
  container: Container,
  input: {
    tenantId: string
    credits: number
    grantRef: string
    actor: string
    note?: string | null
    now: Date
  }
): Promise<{ applied: boolean; balance: number; expiresAt: Date | null }> {
  const credits = aiCreditsIn(container)
  return await withCurrentMonth(container, input.tenantId, input.now, (clock) =>
    credits.grantPurchase(input, clock)
  )
}

/**
 * A staff correction (adr/0085 "Güvenlik"): credits added to or taken from
 * one bucket, with a note (`cp.ai_credit_note_required`) and the staff
 * member's id; a balance never goes below 0 (`cp.ai_credit_balance_short`).
 * Written to the audit log (its amount and bucket, not the note's text).
 */
export async function adjust(
  container: Container,
  input: {
    tenantId: string
    amount: number
    bucket: AiCreditBucket
    note: string
    actor: string
    now: Date
  }
): Promise<{ entryId: string; balance: number }> {
  const credits = aiCreditsIn(container)
  const done = await withCurrentMonth(container, input.tenantId, input.now, (clock) =>
    credits.adjust(input, clock)
  )
  await container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
    kind: "mutation",
    action: "ai_credit.adjust",
    actor_type: "user",
    actor_id: input.actor,
    resource_type: "tenant",
    resource_id: input.tenantId,
    changes: {
      bucket: input.bucket,
      amount: input.amount,
      balance: done.balance,
      entry_id: done.entryId,
    },
  })
  return done
}

/** A top-up asked for with a pack (K11); a second while one is pending is `cp.ai_credit_order_pending`. */
export async function requestOrder(
  container: Container,
  input: { tenantId: string; pack: AiCreditPack; requestedBy: string | null; now: Date }
): Promise<AiCreditOrderRow> {
  return await aiCreditsIn(container).requestOrder(
    input.tenantId,
    input.pack,
    input.requestedBy,
    input.now
  )
}

/**
 * A pending request marked paid and its pack's credits added in the same
 * transaction (`grant_ref` `order:<id>`); marked twice it adds once.
 */
export async function markOrderPaid(
  container: Container,
  input: {
    orderId: string
    actor: string
    method: PaymentMethod
    reference?: string | null
    now: Date
  }
): Promise<{ applied: boolean; order: AiCreditOrderRow }> {
  const credits = aiCreditsIn(container)
  const { tenant_id: tenantId } = await credits.orderOf(input.orderId)
  return await withCurrentMonth(container, tenantId, input.now, (clock) =>
    credits.markOrderPaid(
      input.orderId,
      { actor: input.actor, method: input.method, reference: input.reference ?? null },
      clock
    )
  )
}

/** A pending request cancelled; a paid or cancelled one is `cp.ai_credit_order_closed`. */
export async function cancelOrder(
  container: Container,
  input: { orderId: string; actor: string; now: Date }
): Promise<AiCreditOrderRow> {
  return await aiCreditsIn(container).cancelOrder(input.orderId, input.actor, input.now)
}
