import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils"
import { LegacyOrder } from "./models/legacy-order"
import { MigrationCutover } from "./models/migration-cutover"
import { MigrationFile } from "./models/migration-file"
import { MigrationItem } from "./models/migration-item"
import { MigrationRun } from "./models/migration-run"
import { MigrationUrl } from "./models/migration-url"
import type {
  InventoryUrl,
  ItemStatus,
  ItemTallies,
  KeptFile,
  LegacyOrderInput,
  RememberedItem,
  RunPhase,
} from "./types"

export type {
  InventoryUrl,
  ItemStatus,
  ItemTallies,
  KeptFile,
  LegacyOrderInput,
  RememberedItem,
  RunPhase,
}

// Kinds whose old addresses become 301s (entities.ts); constants, written into the SQL
const ADDRESSED_KINDS =
  "'product', 'category', 'brand', 'page', 'post', 'post_category', 'post_tag'"

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
  MigrationFile,
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
    // One statement may not touch a row twice: a key met twice keeps its last line
    const lines = [...new Map(items.map((item) => [item.source_key, item])).values()]
    for (let start = 0; start < lines.length; start += CHUNK) {
      const chunk = lines.slice(start, start + CHUNK)
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
   * Keeps which media asset each old file became (adr/0059); a path met
   * again takes the later run's asset. How many were new.
   */
  @InjectTransactionManager()
  async keepFiles(
    source: string,
    files: readonly KeptFile[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    const manager = sharedContext.transactionManager as Executor
    // One statement may not touch a row twice: a path met twice keeps its last asset
    const lines = [...new Map(files.map((file) => [file.path, file])).values()]
    let added = 0
    for (let start = 0; start < lines.length; start += CHUNK) {
      const chunk = lines.slice(start, start + CHUNK)
      const rows = (await manager.execute(
        `INSERT INTO migration_file (id, source, path, stem, media_id, created_at, updated_at)
         VALUES ${chunk.map(() => "(?, ?, ?, ?, ?, now(), now())").join(", ")}
         ON CONFLICT (path) WHERE deleted_at IS NULL DO UPDATE
           SET source = EXCLUDED.source, stem = EXCLUDED.stem, media_id = EXCLUDED.media_id,
               updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        chunk.flatMap((file) => [
          generateEntityId(undefined, "mfile"),
          source,
          file.path,
          file.stem,
          file.media_id,
        ])
      )) as { inserted: boolean }[]
      added += rows.filter((row) => row.inserted).length
    }
    return added
  }

  /**
   * Adds old addresses to the inventory (F14.7); one met again gains the
   * new origin, the larger click count and the record a later run tied it
   * to. The owner's decision is never touched.
   */
  @InjectTransactionManager()
  async addUrls(
    urls: readonly InventoryUrl[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    // One statement may not touch a row twice: an address met twice is one, its clicks the larger
    const merged = new Map<string, InventoryUrl>()
    for (const url of urls) {
      const seen = merged.get(url.address)
      merged.set(url.address, {
        ...url,
        clicks: Math.max(seen?.clicks ?? 0, url.clicks ?? 0),
        entity_type: url.entity_type ?? seen?.entity_type ?? null,
        entity_id: url.entity_id ?? seen?.entity_id ?? null,
      })
    }
    const lines = [...merged.values()]
    for (let start = 0; start < lines.length; start += CHUNK) {
      const chunk = lines.slice(start, start + CHUNK)
      await manager.execute(
        `INSERT INTO migration_url
           (id, address, path, query, origins, clicks, entity_type, entity_id, created_at, updated_at)
         VALUES ${chunk.map(() => "(?, ?, ?, ?, ARRAY[?]::text[], ?, ?, ?, now(), now())").join(", ")}
         ON CONFLICT (address) WHERE deleted_at IS NULL DO UPDATE
           SET origins = ARRAY(SELECT DISTINCT unnest(migration_url.origins || EXCLUDED.origins)),
               clicks = GREATEST(migration_url.clicks, EXCLUDED.clicks),
               entity_type = COALESCE(EXCLUDED.entity_type, migration_url.entity_type),
               entity_id = COALESCE(EXCLUDED.entity_id, migration_url.entity_id),
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

  /**
   * Queues every moved customer not queued before for the invitation to
   * open their account (F14.5); how many joined the queue.
   */
  @InjectTransactionManager()
  async queueInvites(@MedusaContext() sharedContext: Context = {}): Promise<number> {
    const manager = sharedContext.transactionManager as Executor
    const rows = (await manager.execute(
      `UPDATE migration_item SET invite_queued_at = now(), updated_at = now()
       WHERE kind = 'customer' AND status = 'done' AND target_id IS NOT NULL
         AND invite_queued_at IS NULL AND deleted_at IS NULL
       RETURNING id`,
      []
    )) as unknown[]
    return rows.length
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

  /** The run's live step, beside its counts (`_phase`); written whole, read by the panel. */
  @InjectTransactionManager()
  async setPhase(
    runId: string,
    phase: RunPhase,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await (sharedContext.transactionManager as Executor).execute(
      `UPDATE migration_run
       SET counts = jsonb_set(COALESCE(counts, '{}'::jsonb), '{_phase}', ?::jsonb), updated_at = now()
       WHERE id = ?`,
      [JSON.stringify(phase), runId]
    )
  }

  /** What moved, counted (adr/0042 Ek 2026-11-27); a picture's key starts with its record's. */
  @InjectManager()
  async tallies(@MedusaContext() sharedContext: Context = {}): Promise<ItemTallies> {
    const manager = sharedContext.manager as Executor
    const items = (await manager.execute(
      `SELECT kind, status, count(*)::int AS count FROM migration_item
       WHERE deleted_at IS NULL GROUP BY kind, status`,
      []
    )) as ItemTallies["items"]
    const unpictured = (await manager.execute(
      `SELECT owner.kind, count(DISTINCT owner.id)::int AS count
       FROM migration_item picture
       JOIN migration_item owner ON owner.source = picture.source
         AND owner.kind IN ('product', 'post') AND owner.status = 'done'
         AND owner.source_key = split_part(picture.source_key, ' ', 1)
         AND owner.deleted_at IS NULL
       WHERE picture.kind = 'image' AND picture.status <> 'done' AND picture.deleted_at IS NULL
       GROUP BY owner.kind`,
      []
    )) as ItemTallies["unpictured"]
    const [unaddressed] = (await manager.execute(
      `SELECT count(*)::int AS count FROM migration_item item
       WHERE item.deleted_at IS NULL AND item.status = 'done' AND item.old_url IS NOT NULL
         AND item.target_id IS NOT NULL AND item.kind IN (${ADDRESSED_KINDS})
         AND NOT EXISTS (SELECT 1 FROM migration_url url
           WHERE url.deleted_at IS NULL AND url.entity_id = item.target_id)`,
      []
    )) as { count: number }[]
    return { items, unpictured, unaddressed: unaddressed?.count ?? 0 }
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
