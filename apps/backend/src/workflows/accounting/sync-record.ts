import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { accountingAdapterOf } from "../../lib/accounting"
import type { AccountingAdapter, AccountingAdapterId, AccountingRef } from "../../lib/accounting"
import { ValidationError } from "../../lib/errors"
import { AUDIT_LOG_MODULE } from "../../modules/audit-log"
import type AuditLogModuleService from "../../modules/audit-log/service"
import { BILLING_PROFILE_MODULE } from "../../modules/billing-profile"
import type BillingProfileModuleService from "../../modules/billing-profile/service"
import type { SyncSource } from "../../modules/accounting/service"
import { sourceOf } from "./sources"
import type { SaleParty, Source } from "./sources"

/** How a record went: the program's id for it, or why nothing was sent. */
export interface Synced {
  external_id: string | null
  skipped: string | null
}

const readSourceStep = createStep(
  "accounting-read-source",
  async (
    input: { adapter: AccountingAdapterId; source_type: SyncSource; source_id: string },
    { container }
  ) => new StepResponse(await sourceOf(container, input))
)

/**
 * The program's customer card for a corporate sale. Its tax id is read
 * here, at the moment it is sent, and the read is recorded against the
 * customer first (docs/04: which customer's record): no record, no read.
 */
async function customerOf(
  container: MedusaContainer,
  adapter: AccountingAdapter,
  party: SaleParty,
  reference: string
): Promise<AccountingRef | null> {
  if (party.kind !== "corporate") {
    return null
  }
  await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
    kind: "sensitive_read",
    action: "accounting.tax_id_sent",
    actor_type: "system",
    actor_id: null,
    resource_type: "customer",
    resource_id: party.customer_id,
    outcome: 200,
    changes: { sync: reference, adapter: adapter.id },
  })
  const taxId = await container
    .resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
    .revealTaxId(party.profile_id, party.customer_id)
  return adapter.upsertCustomer({
    reference: `customer:${party.customer_id}`,
    party: { kind: "corporate", name: party.name, tax_office: party.tax_office, tax_id: taxId },
  })
}

/**
 * Sends the record to the program under our record's id. No compensation:
 * it is the workflow's last step, so nothing after it can undo it, and a
 * record sent again (its answer lost) is the same record to the program,
 * which dedupes on the reference (KK2).
 */
const pushRecordStep = createStep(
  "accounting-push-record",
  async (
    input: { adapter: AccountingAdapterId; reference: string; source: Source },
    { container }
  ) => {
    const { source, reference } = input
    if (source.kind === "skip") {
      return new StepResponse<Synced>({ external_id: null, skipped: source.code })
    }
    const adapter = accountingAdapterOf(input.adapter)
    if (!adapter) {
      throw new ValidationError("accounting.adapter_unavailable")
    }
    let sent: AccountingRef
    if (source.kind === "sale") {
      const { party, ...sale } = source.sale
      const customer = await customerOf(container, adapter, party, reference)
      sent = await adapter.pushSale({ ...sale, reference, customer })
    } else if (source.kind === "cancel") {
      sent = await adapter.cancelSale({ ...source.cancel, reference })
    } else {
      const money = { ...source.money, reference }
      sent = await (source.kind === "payment"
        ? adapter.pushPayment(money)
        : adapter.pushReturn(money))
    }
    return new StepResponse<Synced>({ external_id: sent.external_id, skipped: null })
  }
)

/** One record to the shop's accounting program (F11.5, adr/0039 §5): how it went. */
export const syncAccountingRecordWorkflow = createWorkflow(
  "accounting-sync-record",
  (
    input: WorkflowData<{
      adapter: AccountingAdapterId
      sync_id: string
      source_type: SyncSource
      source_id: string
    }>
  ) => {
    const source = readSourceStep({
      adapter: input.adapter,
      source_type: input.source_type,
      source_id: input.source_id,
    })
    const result = pushRecordStep({ adapter: input.adapter, reference: input.sync_id, source })
    return new WorkflowResponse(result)
  }
)
