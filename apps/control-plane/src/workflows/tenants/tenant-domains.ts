import { MedusaError } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { omit } from "../../lib/omit"
import { MAX_CUSTOM_DOMAINS } from "../../lib/tenants/kinds"
import type { DomainRecord } from "../../modules/tenants/types"
import { tenantsIn } from "../modules"
import { undoableStep } from "../undoable"

type Container = Parameters<typeof tenantsIn>[0]

const refused = (key: string) => new MedusaError(MedusaError.Types.NOT_ALLOWED, key)

async function domainOf(container: Container, tenantId: string, domainId: string) {
  const all = await tenantsIn(container).domainsOf(tenantId)
  const domain = all.find((each) => each.id === domainId)
  if (!domain) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.domain_unknown")
  }
  return { all, domain }
}

/** The primary mark on `id` alone (off first: one primary is a unique index). */
async function markPrimary(container: Container, tenantId: string, id: string | null) {
  const service = tenantsIn(container)
  await service.updateTenantDomains({
    selector: { tenant_id: tenantId, is_primary: true },
    data: { is_primary: false },
  })
  if (id) {
    await service.updateTenantDomains({ id, is_primary: true })
  }
}

const addDomainStep = undoableStep(
  "cp-tenant-add-domain",
  async (input: { tenant_id: string; hostname: string }, container) => {
    const service = tenantsIn(container)
    const own = (await service.domainsOf(input.tenant_id)).filter((each) => each.kind === "custom")
    if (own.length >= MAX_CUSTOM_DOMAINS) {
      throw refused("cp.domains_full")
    }
    await service.refuseTakenHost(input.hostname)
    const [made] = await service.createTenantDomains([
      { tenant_id: input.tenant_id, hostname: input.hostname, kind: "custom" },
    ])
    return { output: { id: made?.id ?? "" }, undo: made?.id ?? "" }
  },
  async (id: string, container) => {
    if (id) {
      await tenantsIn(container).deleteTenantDomains([id])
    }
  }
)

/** A custom domain recorded, its DNS check pending (F16.7). */
export const addDomainWorkflow = createWorkflow(
  { name: "cp-tenant-add-domain", store: false },
  (input: WorkflowData<{ tenant_id: string; hostname: string }>) =>
    new WorkflowResponse(addDomainStep(input))
)

interface DomainInput {
  tenant_id: string
  domain_id: string
}

interface DomainUndo {
  tenant_id: string
  removed: DomainRecord | null
  primary: string | null
}

const putBack = async (undo: DomainUndo, container: Container) => {
  if (undo.removed) {
    const row = omit(undo.removed, "tenant_id", "created_at")
    await tenantsIn(container).createTenantDomains([
      { ...row, tenant_id: undo.tenant_id, is_primary: false },
    ])
  }
  await markPrimary(container, undo.tenant_id, undo.primary)
}

const primaryOf = (all: DomainRecord[]) => all.find((each) => each.is_primary)?.id ?? null

const removeDomainStep = undoableStep(
  "cp-tenant-remove-domain",
  async (input: DomainInput, container) => {
    const { all, domain } = await domainOf(container, input.tenant_id, input.domain_id)
    if (domain.kind === "platform_subdomain") {
      throw refused("cp.domain_platform_kept")
    }
    await tenantsIn(container).deleteTenantDomains([domain.id])
    // The primary one gone, the platform's subdomain takes over (filled in, not asked)
    if (domain.is_primary) {
      const fallback = all.find((each) => each.kind === "platform_subdomain")
      await markPrimary(container, input.tenant_id, fallback?.id ?? null)
    }
    const undo: DomainUndo = {
      tenant_id: input.tenant_id,
      removed: domain,
      primary: primaryOf(all),
    }
    return { output: { id: domain.id, hostname: domain.hostname }, undo }
  },
  putBack
)

/** A custom domain removed; the platform's subdomain stays always. */
export const removeDomainWorkflow = createWorkflow(
  { name: "cp-tenant-remove-domain", store: false },
  (input: WorkflowData<DomainInput>) => new WorkflowResponse(removeDomainStep(input))
)

const primaryStep = undoableStep(
  "cp-tenant-primary-domain",
  async (input: DomainInput, container) => {
    const { all, domain } = await domainOf(container, input.tenant_id, input.domain_id)
    // An unverified domain as the canonical address would break the storefront's links
    if (domain.verification !== "verified") {
      throw refused("cp.domain_unverified")
    }
    await markPrimary(container, input.tenant_id, domain.id)
    const from = all.find((each) => each.is_primary)?.hostname ?? null
    const undo: DomainUndo = { tenant_id: input.tenant_id, removed: null, primary: primaryOf(all) }
    return { output: { from, to: domain.hostname }, undo }
  },
  putBack
)

/** The shop's primary address: verified domains only. */
export const primaryDomainWorkflow = createWorkflow(
  { name: "cp-tenant-primary-domain", store: false },
  (input: WorkflowData<DomainInput>) => new WorkflowResponse(primaryStep(input))
)
