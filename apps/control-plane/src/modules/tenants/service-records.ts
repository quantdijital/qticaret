import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import { TENANT_STATUSES, canTransitionTenant } from "@qticaret/types/control-plane"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { omit } from "../../lib/omit"
import { Tenant } from "./models/tenant"
import { TenantCompany } from "./models/tenant-company"
import { TenantContact } from "./models/tenant-contact"
import { TenantDomain } from "./models/tenant-domain"
import { TenantNote } from "./models/tenant-note"
import { TenantStatusChange } from "./models/tenant-status-change"
import { COMPANY_FIELDS, DOMAIN_FIELDS } from "./types"
import type { CompanyFields, CompanyRecord, DomainRecord, TenantRecord } from "./types"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

export const notFound = (key: string) => new MedusaError(MedusaError.Types.NOT_FOUND, key)
const refused = (key: string) => new MedusaError(MedusaError.Types.NOT_ALLOWED, key)
const taken = (key: string) => new MedusaError(MedusaError.Types.DUPLICATE_ERROR, key)

/**
 * The shops' records (adr/0061 §2), the part that is not their people: a
 * new record with its subdomain and first status row, its lifecycle, its
 * company and domains. Contacts are `TenantsModuleService`'s (service.ts).
 */
export class TenantsRecords extends MedusaService({
  Tenant,
  TenantCompany,
  TenantContact,
  TenantDomain,
  TenantStatusChange,
  TenantNote,
}) {
  /** A new shop record: `provisioning`, its platform subdomain primary, its first status row. */
  @InjectTransactionManager()
  async createTenantRecord(
    input: { slug: string; name: string; created_by: string | null; hostname: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TenantRecord> {
    const [sameSlug] = await this.listTenants({ slug: input.slug }, { take: 1 }, sharedContext)
    if (sameSlug) {
      throw taken("cp.slug_taken")
    }
    await this.refuseTakenHost(input.hostname, sharedContext)
    const [tenant] = await this.createTenants(
      [
        {
          slug: input.slug,
          name: input.name,
          status: "provisioning",
          status_changed_at: new Date(),
          created_by: input.created_by,
        },
      ],
      sharedContext
    )
    if (!tenant) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "cp.tenant_not_created")
    }
    await this.createTenantDomains(
      [
        {
          tenant_id: tenant.id,
          hostname: input.hostname,
          kind: "platform_subdomain",
          verification: "verified",
          is_primary: true,
        },
      ],
      sharedContext
    )
    await this.createTenantStatusChanges(
      [
        {
          tenant_id: tenant.id,
          from_status: null,
          to_status: "provisioning",
          reason_code: "created",
          actor: input.created_by ?? "system",
        },
      ],
      sharedContext
    )
    return tenant
  }

  /** The shop, or 404 `cp.tenant_unknown`. */
  @InjectManager()
  async tenantOf(id: string, @MedusaContext() sharedContext: Context = {}): Promise<TenantRecord> {
    const [tenant] = await this.listTenants({ id }, { take: 1 }, sharedContext)
    if (!tenant) {
      throw notFound("cp.tenant_unknown")
    }
    return tenant
  }

  /**
   * A move in the lifecycle, only along the contract's transitions
   * (adr/0061 §2), with its row. Who may ask for which is the caller's.
   */
  @InjectTransactionManager()
  async changeStatus(
    id: string,
    to: TenantStatus,
    input: { reason_code: string; actor: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ from: TenantStatus; to: TenantStatus }> {
    const tenant = await this.tenantOf(id, sharedContext)
    if (!canTransitionTenant(tenant.status, to)) {
      throw refused("cp.status_transition")
    }
    await this.updateTenants({ id, status: to, status_changed_at: new Date() }, sharedContext)
    await this.createTenantStatusChanges(
      [{ tenant_id: id, from_status: tenant.status, to_status: to, ...input }],
      sharedContext
    )
    return { from: tenant.status, to }
  }

  /** How many shops are in each status (the list's tabs). */
  @InjectManager()
  async statusCounts(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Record<TenantStatus, number>> {
    const manager = sharedContext.manager as Executor
    const rows = (await manager.execute(
      `SELECT status, count(*)::int AS n FROM tenant WHERE deleted_at IS NULL GROUP BY status`,
      []
    )) as { status: TenantStatus; n: number }[]
    const counts = Object.fromEntries(TENANT_STATUSES.map((status) => [status, 0])) as Record<
      TenantStatus,
      number
    >
    for (const row of rows) {
      counts[row.status] = row.n
    }
    return counts
  }

  @InjectManager()
  async companyOf(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CompanyRecord | null> {
    const [company] = await this.listTenantCompanies(
      { tenant_id: tenantId },
      { select: ["id", "tenant_id", ...COMPANY_FIELDS], take: 1 },
      sharedContext
    )
    return (company as unknown as CompanyRecord | undefined) ?? null
  }

  /** The company's fields set (made on first save); what they were comes back to undo it. */
  @InjectTransactionManager()
  async saveCompany(
    tenantId: string,
    fields: Partial<CompanyFields>,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ before: CompanyRecord | null }> {
    const before = await this.companyOf(tenantId, sharedContext)
    if (before) {
      await this.updateTenantCompanies({ id: before.id, ...fields }, sharedContext)
    } else {
      await this.createTenantCompanies([{ tenant_id: tenantId, ...fields }], sharedContext)
    }
    return { before }
  }

  /** The company back as it was: removed when there was none. */
  @InjectTransactionManager()
  async restoreCompany(
    tenantId: string,
    before: CompanyRecord | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    if (before) {
      await this.updateTenantCompanies(omit(before, "tenant_id"), sharedContext)
      return
    }
    const current = await this.companyOf(tenantId, sharedContext)
    if (current) {
      await this.deleteTenantCompanies([current.id], sharedContext)
    }
  }

  @InjectManager()
  async domainsOf(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<DomainRecord[]> {
    return await this.listTenantDomains(
      { tenant_id: tenantId },
      { select: [...DOMAIN_FIELDS], order: { created_at: "ASC" }, take: 100 },
      sharedContext
    )
  }

  /** 422 `cp.domain_taken` when any shop answers on the host already. */
  @InjectManager()
  async refuseTakenHost(
    hostname: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [same] = await this.listTenantDomains({ hostname }, { take: 1 }, sharedContext)
    if (same) {
      throw taken("cp.domain_taken")
    }
  }
}
