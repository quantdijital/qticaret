import { MedusaError } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { checkDomainDns } from "../../lib/domains/dns"
import { routingTarget } from "../../lib/domains/target"
import { newVerificationToken, nextCheckState } from "../../lib/domains/verification"
import type { CheckOutcome } from "../../lib/domains/verification"
import { isVerifiedDomain } from "../../lib/tenants/kinds"
import type { DomainRecord } from "../../modules/tenants/types"
import { tenantsIn } from "../modules"
import { undoableStep } from "../undoable"

export interface DomainCheckInput {
  tenant_id: string
  domain_id: string
  /** A staff member's "Doğrula": an expired pending domain is not failed by it. */
  manual?: boolean
}

export interface DomainCheckResult {
  id: string
  hostname: string
  from: DomainRecord["verification"]
  to: DomainRecord["verification"]
  error: DomainRecord["verification_error"]
  /** Whether the shop's verified hosts changed: its plan document is issued again. */
  proof_changed: boolean
}

type Undo = Pick<
  DomainRecord,
  | "id"
  | "verification"
  | "verification_error"
  | "verified_at"
  | "txt_lost_since"
  | "last_checked_at"
  | "next_check_at"
  | "check_attempts"
  | "verification_token"
>

const checkStep = undoableStep(
  "cp-tenant-check-domain",
  async (input: DomainCheckInput, container) => {
    const service = tenantsIn(container)
    const domain = (await service.domainsOf(input.tenant_id)).find(
      (each) => each.id === input.domain_id
    )
    if (!domain) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.domain_unknown")
    }
    if (domain.kind !== "custom") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.domain_platform_kept")
    }
    const undo: Undo = {
      id: domain.id,
      verification: domain.verification,
      verification_error: domain.verification_error,
      verified_at: domain.verified_at,
      txt_lost_since: domain.txt_lost_since,
      last_checked_at: domain.last_checked_at,
      next_check_at: domain.next_check_at,
      check_attempts: domain.check_attempts,
      verification_token: domain.verification_token,
    }
    // A domain recorded before its token existed gets one; DNS cannot hold it yet
    const token = domain.verification_token ?? newVerificationToken()
    const now = new Date()
    // DNS only, bounded in time (lib/domains/dns.ts); the tests' answers come from CP_DNS_FAKE
    const finding = await checkDomainDns(domain.hostname, token, routingTarget())
    const outcome: CheckOutcome = nextCheckState(domain, finding, now, {
      manual: input.manual === true,
    })
    await service.updateTenantDomains({ id: domain.id, verification_token: token, ...outcome })
    // A domain taken back (its proof long gone, F16.7 review M1) is no longer the shop's
    // address: the platform's subdomain is primary again
    const dropped = domain.is_primary && !isVerifiedDomain(outcome.verification)
    if (dropped) {
      await service.updateTenantDomains({ id: domain.id, is_primary: false })
      const platform = (await service.domainsOf(input.tenant_id)).find(
        (each) => each.kind === "platform_subdomain"
      )
      if (platform) {
        await service.updateTenantDomains({ id: platform.id, is_primary: true })
      }
    }
    const result: DomainCheckResult = {
      id: domain.id,
      hostname: domain.hostname,
      from: domain.verification,
      to: outcome.verification,
      error: outcome.verification_error,
      proof_changed:
        isVerifiedDomain(domain.verification) !== isVerifiedDomain(outcome.verification),
    }
    return { output: result, undo: { row: undo, tenant_id: input.tenant_id, was_primary: dropped } }
  },
  async (back: { row: Undo; tenant_id: string; was_primary: boolean }, container) => {
    const service = tenantsIn(container)
    if (back.was_primary) {
      await service.updateTenantDomains({
        selector: { tenant_id: back.tenant_id, is_primary: true },
        data: { is_primary: false },
      })
    }
    await service.updateTenantDomains({
      ...back.row,
      ...(back.was_primary ? { is_primary: true } : {}),
    })
  }
)

/**
 * A custom domain's DNS checked (F16.7) and its state moved: by a staff
 * member's "Doğrula" or by the job (lib/domains/checks.ts). Only DNS is
 * asked; the shop's plan document follows when the verified hosts
 * change (the caller's, after the workflow).
 */
export const checkDomainWorkflow = createWorkflow(
  { name: "cp-tenant-check-domain", store: false },
  (input: WorkflowData<DomainCheckInput>) => new WorkflowResponse(checkStep(input))
)
