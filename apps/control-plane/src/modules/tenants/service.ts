import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
} from "@medusajs/framework/utils"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { MAX_CONTACTS } from "../../lib/tenants/kinds"
import { omit } from "../../lib/omit"
import { heirOnRemoval, primaryOnSave } from "../../lib/tenants/contacts"
import { tcknContext } from "../../lib/tenants/tckn"
import { emptyTally, kekOf, olderKekIds, rewrapRows } from "../../lib/vault/rewrap"
import type { RewrapTally } from "../../lib/vault/rewrap"
import { TenantsRecords, notFound } from "./service-records"
import { CONTACT_FIELDS } from "./types"
import type { ContactFields, ContactRecord } from "./types"

/**
 * Writes what is pending now. The ORM flushes inserts before updates, so a
 * mark taken off one row must reach the database before another row takes
 * it (one primary billing contact is a unique index).
 */
interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

const REWRAP_BATCH = 100

async function flushNow(sharedContext: Context): Promise<void> {
  await (sharedContext.transactionManager as { flush: () => Promise<void> }).flush()
}

export interface ContactChange {
  id: string
  /** The row as it was; null when this made it. */
  before: ContactRecord | null
  /** The shop's contacts before the change: the undo puts them back. */
  snapshot: ContactRecord[]
}

/**
 * The shops the platform runs (adr/0061 §2): the record and its company,
 * contacts, domains, notes and status history (service-records.ts holds
 * all but the contacts). The changes that touch several rows (a new
 * record with its subdomain, the primary billing contact) run in one
 * transaction here; the workflows around them undo them when a later step
 * fails.
 */
class TenantsModuleService extends TenantsRecords {
  /**
   * A move taken back by its workflow's compensation (Ek C15): the status
   * as it was and the move's row gone, only while the shop is still where
   * the move left it (a later move is never undone).
   */
  @InjectTransactionManager()
  async undoStatusChange(
    id: string,
    undo: { from: TenantStatus; to: TenantStatus; change_id: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const tenant = await this.tenantOf(id, sharedContext)
    if (tenant.status !== undo.to) {
      return
    }
    await this.updateTenants(
      { id, status: undo.from, status_changed_at: new Date() },
      sharedContext
    )
    if (undo.change_id) {
      await this.deleteTenantStatusChanges([undo.change_id], sharedContext)
    }
  }

  @InjectManager()
  async contactsOf(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ContactRecord[]> {
    return await this.listTenantContacts(
      { tenant_id: tenantId },
      { select: [...CONTACT_FIELDS], order: { created_at: "ASC" }, take: 200 },
      sharedContext
    )
  }

  /**
   * A contact added or changed, the primary billing mark moved as
   * `primaryOnSave` says. The contacts as they were come back to undo it.
   */
  @InjectTransactionManager()
  async saveContact(
    tenantId: string,
    contactId: string | null,
    fields: Omit<ContactFields, "is_primary_billing"> & {
      is_primary_billing?: boolean | undefined
    },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ContactChange> {
    const snapshot = await this.contactsOf(tenantId, sharedContext)
    const before = snapshot.find((each) => each.id === contactId) ?? null
    if (contactId && !before) {
      throw notFound("cp.contact_unknown")
    }
    if (!before && snapshot.length >= MAX_CONTACTS) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.contacts_full")
    }
    const { primary, demote } = primaryOnSave(snapshot, contactId, fields.is_primary_billing)
    if (demote.length > 0) {
      await this.updateTenantContacts(
        { selector: { id: demote }, data: { is_primary_billing: false } },
        sharedContext
      )
      await flushNow(sharedContext)
    }
    const data = { ...fields, is_primary_billing: primary }
    const [saved] = before
      ? [await this.updateTenantContacts({ id: before.id, ...data }, sharedContext)]
      : await this.createTenantContacts([{ tenant_id: tenantId, ...data }], sharedContext)
    return { id: saved?.id ?? "", before, snapshot }
  }

  /** A contact removed for good (personal data, no soft delete); its mark to `heirOnRemoval`. */
  @InjectTransactionManager()
  async removeContact(
    tenantId: string,
    contactId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ContactChange> {
    const snapshot = await this.contactsOf(tenantId, sharedContext)
    const before = snapshot.find((each) => each.id === contactId)
    if (!before) {
      throw notFound("cp.contact_unknown")
    }
    await this.deleteTenantContacts([contactId], sharedContext)
    await flushNow(sharedContext)
    const heir = heirOnRemoval(snapshot, contactId)
    if (heir) {
      await this.updateTenantContacts({ id: heir, is_primary_billing: true }, sharedContext)
    }
    return { id: contactId, before, snapshot }
  }

  /** A shop's contacts put back exactly as `snapshot` had them (a step's undo). */
  @InjectTransactionManager()
  async restoreContacts(
    tenantId: string,
    snapshot: ContactRecord[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const kept = new Set(snapshot.map((row) => row.id))
    const current = await this.contactsOf(tenantId, sharedContext)
    const extra = current.filter((row) => !kept.has(row.id)).map((row) => row.id)
    if (extra.length > 0) {
      await this.deleteTenantContacts(extra, sharedContext)
    }
    // Marks off first: the one primary billing contact is a unique index
    await this.updateTenantContacts(
      { selector: { tenant_id: tenantId }, data: { is_primary_billing: false } },
      sharedContext
    )
    await flushNow(sharedContext)
    const present = new Set(current.map((row) => row.id))
    for (const row of snapshot) {
      const fields = omit(row, "tenant_id", "created_at")
      if (present.has(row.id)) {
        await this.updateTenantContacts(fields, sharedContext)
      } else {
        await this.createTenantContacts([{ ...fields, tenant_id: tenantId }], sharedContext)
      }
    }
  }

  /** How many sealed TCKNs each KEK holds (the KEK id is the envelope's second part). */
  @InjectManager()
  async tcknCountsByKek(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, number>> {
    const rows = (await (sharedContext.manager as Executor).execute(
      `SELECT split_part(tckn_sealed, '.', 2) AS kek_id, count(*)::int AS n
         FROM tenant_company WHERE tckn_sealed IS NOT NULL AND deleted_at IS NULL GROUP BY 1`,
      []
    )) as { kek_id: string; n: number }[]
    return new Map(rows.map((row) => [row.kek_id, row.n]))
  }

  /**
   * One pass of the KEK rotation over the sealed TCKNs (adr/0061 §4.1,
   * lib/vault/rewrap.ts): their data keys rewrapped, never opened.
   */
  @InjectManager()
  async rewrapTckns(@MedusaContext() sharedContext: Context = {}): Promise<RewrapTally> {
    const older = new Set(olderKekIds())
    const tally = emptyTally()
    let after = ""
    while (older.size > 0) {
      const rows = (await (sharedContext.manager as Executor).execute(
        `SELECT id, tenant_id, tckn_sealed FROM tenant_company
          WHERE tckn_sealed IS NOT NULL AND deleted_at IS NULL AND id > ?
          ORDER BY id LIMIT ?`,
        [after, REWRAP_BATCH]
      )) as { id: string; tenant_id: string; tckn_sealed: string }[]
      await rewrapRows(
        rows
          .filter((row) => older.has(kekOf(row.tckn_sealed) ?? ""))
          .map((row) => ({
            id: row.id,
            sealed: row.tckn_sealed,
            context: tcknContext(row.tenant_id),
          })),
        (id, from, to) => this.swapTckn(id, from, to),
        tally
      )
      if (rows.length < REWRAP_BATCH) {
        break
      }
      after = rows[rows.length - 1]?.id ?? after
    }
    return tally
  }

  /** Writes `to` only while the row still holds `from`. Whether it did. */
  @InjectTransactionManager()
  protected async swapTckn(
    id: string,
    from: string,
    to: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const rows = (await (sharedContext.transactionManager as Executor).execute(
      `UPDATE tenant_company SET tckn_sealed = ?, updated_at = now()
        WHERE id = ? AND tckn_sealed = ? AND deleted_at IS NULL RETURNING id`,
      [to, id, from]
    )) as unknown[]
    return rows.length > 0
  }
}

export default TenantsModuleService
