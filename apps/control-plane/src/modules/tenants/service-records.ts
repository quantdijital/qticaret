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
    input: {
      slug: string
      name: string
      created_by: string | null
      hostname: string
      sector_pack?: string | null
      preset?: string | null
      storefront_contact?: boolean
    },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TenantRecord> {
    if (await this.slugTaken(input.slug, sharedContext)) {
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
          sector_pack: input.sector_pack ?? null,
          preset: input.preset ?? null,
          storefront_contact: input.storefront_contact ?? true,
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
   * (adr/0061 §2), with its row. Who may ask for which is the caller's;
   * `from`, when given, is where the caller saw the shop: checked again
   * under the row's lock, so two moves at once cannot both pass (Ek C15 L4).
   */
  @InjectTransactionManager()
  async changeStatus(
    id: string,
    to: TenantStatus,
    {
      from,
      ...row
    }: {
      reason_code: string
      actor: string
      note?: string | null
      from?: readonly TenantStatus[]
    },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ from: TenantStatus; to: TenantStatus; change_id: string }> {
    await (sharedContext.transactionManager as Executor).execute(
      "SELECT id FROM tenant WHERE id = ? FOR UPDATE",
      [id]
    )
    const tenant = await this.tenantOf(id, sharedContext)
    if (!canTransitionTenant(tenant.status, to) || (from && !from.includes(tenant.status))) {
      // The route answers it 409 (Ek C15)
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.status_transition")
    }
    await this.updateTenants({ id, status: to, status_changed_at: new Date() }, sharedContext)
    const [change] = await this.createTenantStatusChanges(
      [{ tenant_id: id, from_status: tenant.status, to_status: to, ...row }],
      sharedContext
    )
    return { from: tenant.status, to, change_id: change?.id ?? "" }
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

  /**
   * The company back as it was: removed when there was none. The sealed
   * TCKN goes back only if the save changed it (`written`) and the row
   * still holds what the save wrote (compare-and-swap): a KEK rewrap in
   * between keeps its newer envelope (Ek C8, review INFO).
   */
  @InjectTransactionManager()
  async restoreCompany(
    tenantId: string,
    before: CompanyRecord | null,
    written?: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    if (before) {
      await this.updateTenantCompanies(
        omit(before, "tenant_id", "tckn_sealed", "tckn_last4"),
        sharedContext
      )
      if (written !== undefined) {
        await (sharedContext.transactionManager as Executor).execute(
          `UPDATE tenant_company SET tckn_sealed = ?, tckn_last4 = ?, updated_at = now()
            WHERE id = ? AND tckn_sealed IS NOT DISTINCT FROM ?`,
          [before.tckn_sealed ?? null, before.tckn_last4 ?? null, before.id, written]
        )
      }
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

  /** Whether a shop (not removed) has the slug. */
  @InjectManager()
  async slugTaken(slug: string, @MedusaContext() sharedContext: Context = {}): Promise<boolean> {
    const [same] = await this.listTenants({ slug }, { take: 1, select: ["id"] }, sharedContext)
    return same !== undefined
  }

  /** Whether any shop answers on the host already. */
  @InjectManager()
  async hostTaken(
    hostname: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const [same] = await this.listTenantDomains(
      { hostname },
      { take: 1, select: ["id"] },
      sharedContext
    )
    return same !== undefined
  }

  /** 422 `cp.domain_taken` when any shop answers on the host already. */
  @InjectManager()
  async refuseTakenHost(
    hostname: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    if (await this.hostTaken(hostname, sharedContext)) {
      throw taken("cp.domain_taken")
    }
  }
}
