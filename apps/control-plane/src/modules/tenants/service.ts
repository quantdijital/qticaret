import type { Context } from "@medusajs/framework/types"
import { InjectManager, InjectTransactionManager, MedusaContext } from "@medusajs/framework/utils"
import { omit } from "../../lib/omit"
import { heirOnRemoval, primaryOnSave } from "../../lib/tenants/contacts"
import { TenantsRecords, notFound } from "./service-records"
import { CONTACT_FIELDS } from "./types"
import type { ContactFields, ContactRecord } from "./types"

/**
 * Writes what is pending now. The ORM flushes inserts before updates, so a
 * mark taken off one row must reach the database before another row takes
 * it (one primary billing contact is a unique index).
 */
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
}

export default TenantsModuleService
