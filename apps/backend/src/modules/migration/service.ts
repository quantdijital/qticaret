import type { Context } from "@medusajs/framework/types"
import {
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils"
import { LegacyOrder } from "./models/legacy-order"
import { MigrationCutover } from "./models/migration-cutover"
import { MigrationItem } from "./models/migration-item"
import type { ITEM_STATUSES } from "./models/migration-item"
import { MigrationRun } from "./models/migration-run"
import { MigrationUrl } from "./models/migration-url"
import type { URL_ORIGINS } from "./models/migration-url"

export type ItemStatus = (typeof ITEM_STATUSES)[number]

export interface RememberedItem {
  source_key: string
  target_id: string | null
  status: ItemStatus
  error_code?: string | null
  old_url?: string | null
}

export interface LegacyOrderInput {
  source_key: string
  number: string
  placed_at: Date
  currency_code: string
  total: string
  status: string
  customer_id: string | null
  email: string | null
  lines: { title: string; sku: string | null; quantity: number; total: string }[]
}

export interface InventoryUrl {
  address: string
  path: string
  query: string | null
  origin: (typeof URL_ORIGINS)[number]
  clicks?: number | null
  entity_type?: string | null
  entity_id?: string | null
}

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

// Records written in one statement at most
const CHUNK = 200

/** A shop's data moved from its old platform (F14, adr/0042 §3, §4). */
class MigrationModuleService extends MedusaService({
  MigrationRun,
  MigrationItem,
  LegacyOrder,
  MigrationUrl,
  MigrationCutover,
}) {
  /** What a source's records became here, by their keys: the ones a run met before. */
  async targetsOf(source: string, kind: string, keys: readonly string[]) {
    const found = new Map<string, { target_id: string | null; status: ItemStatus }>()
    for (let start = 0; start < keys.length; start += CHUNK) {
      const rows = await this.listMigrationItems(
        { source, kind, source_key: keys.slice(start, start + CHUNK) },
        { select: ["source_key", "target_id", "status"], take: CHUNK }
      )
      for (const row of rows) {
        found.set(row.source_key, { target_id: row.target_id, status: row.status })
      }
    }
    return found
  }

  /**
   * Keeps what each source record became; met again, its line is brought
   * up to date, never added twice (adr/0042 §3, KK2).
   */
  @InjectTransactionManager()
  async remember(
    source: string,
    kind: string,
    items: readonly RememberedItem[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    for (let start = 0; start < items.length; start += CHUNK) {
      const chunk = items.slice(start, start + CHUNK)
      await manager.execute(
        `INSERT INTO migration_item
           (id, source, kind, source_key, target_id, status, error_code, old_url, created_at, updated_at)
         VALUES ${chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, now(), now())").join(", ")}
         ON CONFLICT (source, kind, source_key) WHERE deleted_at IS NULL DO UPDATE
           SET target_id = COALESCE(EXCLUDED.target_id, migration_item.target_id),
               status = EXCLUDED.status,
               error_code = EXCLUDED.error_code,
               old_url = COALESCE(EXCLUDED.old_url, migration_item.old_url),
               updated_at = now()`,
        chunk.flatMap((item) => [
          generateEntityId(undefined, "mitem"),
          source,
          kind,
          item.source_key,
          item.target_id,
          item.status,
          item.error_code ?? null,
          item.old_url ?? null,
        ])
      )
    }
  }

  /**
   * Adds old addresses to the inventory (F14.7); one met again gains the
   * new origin, the larger click count and a record it had none of. The
   * owner's decision is never touched.
   */
  @InjectTransactionManager()
  async addUrls(
    urls: readonly InventoryUrl[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    for (let start = 0; start < urls.length; start += CHUNK) {
      const chunk = urls.slice(start, start + CHUNK)
      await manager.execute(
        `INSERT INTO migration_url
           (id, address, path, query, origins, clicks, entity_type, entity_id, created_at, updated_at)
         VALUES ${chunk.map(() => "(?, ?, ?, ?, ARRAY[?]::text[], ?, ?, ?, now(), now())").join(", ")}
         ON CONFLICT (address) WHERE deleted_at IS NULL DO UPDATE
           SET origins = ARRAY(SELECT DISTINCT unnest(migration_url.origins || EXCLUDED.origins)),
               clicks = GREATEST(migration_url.clicks, EXCLUDED.clicks),
               entity_type = COALESCE(migration_url.entity_type, EXCLUDED.entity_type),
               entity_id = COALESCE(migration_url.entity_id, EXCLUDED.entity_id),
               updated_at = now()`,
        chunk.flatMap((url) => [
          generateEntityId(undefined, "murl"),
          url.address,
          url.path,
          url.query,
          url.origin,
          url.clicks ?? 0,
          url.entity_type ?? null,
          url.entity_id ?? null,
        ])
      )
    }
  }

  /** Adds a kind's counts to the run's, as the run goes. */
  async count(runId: string, kind: string, delta: Readonly<Record<string, number>>) {
    const run = await this.retrieveMigrationRun(runId, { select: ["counts"] })
    const counts = run.counts as Record<string, Record<string, number>>
    const own = { ...(counts[kind] ?? {}) }
    for (const [key, value] of Object.entries(delta)) {
      own[key] = (own[key] ?? 0) + value
    }
    await this.updateMigrationRuns({ id: runId, counts: { ...counts, [kind]: own } })
  }

  /** Which of a source's orders a run kept before, by their keys. */
  async keptLegacyOrders(source: string, keys: readonly string[]): Promise<Set<string>> {
    const kept = new Set<string>()
    for (let start = 0; start < keys.length; start += CHUNK) {
      const rows = await this.listLegacyOrders(
        { source, source_key: keys.slice(start, start + CHUNK) },
        { select: ["source_key"], take: CHUNK }
      )
      for (const row of rows) {
        kept.add(row.source_key)
      }
    }
    return kept
  }

  /**
   * Orders from the old platform, ones not kept yet (`keptLegacyOrders`);
   * one kept meanwhile is refused by its key, never kept twice.
   */
  async addLegacyOrders(source: string, orders: readonly LegacyOrderInput[]): Promise<void> {
    if (orders.length > 0) {
      await this.createLegacyOrders(
        orders.map((order) => ({
          source,
          ...order,
          total: Number(order.total),
          lines: { lines: order.lines },
        }))
      )
    }
  }
}

export default MigrationModuleService
