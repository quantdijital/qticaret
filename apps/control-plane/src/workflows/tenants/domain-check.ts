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
    const result: DomainCheckResult = {
      id: domain.id,
      hostname: domain.hostname,
      from: domain.verification,
      to: outcome.verification,
      error: outcome.verification_error,
      proof_changed:
        isVerifiedDomain(domain.verification) !== isVerifiedDomain(outcome.verification),
    }
    return { output: result, undo }
  },
  async (undo: Undo, container) => {
    await tenantsIn(container).updateTenantDomains({ ...undo })
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
