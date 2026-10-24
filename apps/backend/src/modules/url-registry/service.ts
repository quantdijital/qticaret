import type { Context, InferTypeOf } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { ValidationError, uniqueViolationKeys } from "../../lib/errors"
import { UrlEntry } from "./models/url-entry"
import { assertUrlKey, assertUrlOwner, isUrlKey } from "./validation"
import type { UrlKey, UrlOwner } from "./validation"

export type UrlEntryRecord = InferTypeOf<typeof UrlEntry>
export type PathStatus = UrlEntryRecord["status"]

export interface ResolvedPath extends UrlOwner {
  status: PathStatus
}

/** What a claim changed, so a workflow compensation can undo it with `unclaimPath`. */
export interface PathClaim {
  entry: UrlEntryRecord
  previousStatus: PathStatus | "none"
  /** The owner's earlier active paths in the locale, now reserved: the sources of their 301s. */
  replacedPaths: string[]
}

const isSameOwner = (entry: UrlOwner, owner: UrlOwner): boolean =>
  entry.entity_type === owner.entity_type && entry.entity_id === owner.entity_id

const pathTakenError = () => new ValidationError("seo.path_taken", { field: "path" })
const pathNotOwnedError = () => new ValidationError("seo.path_not_owned", { field: "path" })

/**
 * Storefront paths, unique per locale across products, categories, pages...
 * (F2.11, docs/13 §2.1). A record has one active path per locale; old paths
 * stay reserved for it while their redirects live.
 */
class UrlRegistryModuleService extends MedusaService({ UrlEntry }) {
  /**
   * Makes `path` the owner's active path in its locale. The owner's earlier
   * active path there becomes reserved (a slug change), its own reserved
   * path becomes active again, and a path another record holds throws
   * `seo.path_taken`.
   */
  async claimPath(input: UrlKey & UrlOwner, sharedContext: Context = {}): Promise<PathClaim> {
    assertUrlKey(input)
    assertUrlOwner(input)
    try {
      return await this.claimPathInTransaction_(input, sharedContext)
    } catch (error) {
      // The insert runs when the transaction commits, so a concurrent claim
      // that took the path first surfaces here, outside the transaction
      if (uniqueViolationKeys(error)?.includes("path")) {
        throw pathTakenError()
      }
      throw error
    }
  }

  @InjectTransactionManager()
  protected async claimPathInTransaction_(
    input: UrlKey & UrlOwner,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PathClaim> {
    const { locale, path, entity_type, entity_id } = input
    const [existing] = await this.listUrlEntries({ locale, path }, { take: 1 }, sharedContext)
    if (existing && !isSameOwner(existing, input)) {
      throw pathTakenError()
    }
    if (existing?.status === "active") {
      return { entry: existing, previousStatus: "active", replacedPaths: [] }
    }
    const active = await this.listUrlEntries(
      { locale, entity_type, entity_id, status: "active" },
      {},
      sharedContext
    )
    if (active.length > 0) {
      await this.updateUrlEntries(
        active.map(({ id }) => ({ id, status: "reserved" as const })),
        sharedContext
      )
    }
    const entry = existing
      ? await this.updateUrlEntries({ id: existing.id, status: "active" }, sharedContext)
      : await this.createUrlEntries(
          { locale, path, entity_type, entity_id, status: "active" },
          sharedContext
        )
    return {
      entry,
      previousStatus: existing ? "reserved" : "none",
      replacedPaths: active.map((replaced) => replaced.path),
    }
  }

  /**
   * Undoes `claimPath` (workflow compensation): the path returns to its
   * previous state and the paths the claim reserved become active again.
   */
  @InjectTransactionManager()
  async unclaimPath(claim: PathClaim, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const { entry, previousStatus, replacedPaths } = claim
    const [current] = await this.listUrlEntries({ id: entry.id }, { take: 1 }, sharedContext)
    if (current && isSameOwner(current, entry)) {
      if (previousStatus === "none") {
        await this.softDeleteUrlEntries([current.id], {}, sharedContext)
      } else if (previousStatus === "reserved") {
        await this.updateUrlEntries({ id: current.id, status: "reserved" }, sharedContext)
      }
    }
    if (replacedPaths.length === 0) {
      return
    }
    const { locale, entity_type, entity_id } = entry
    const replaced = await this.listUrlEntries(
      { locale, entity_type, entity_id, path: replacedPaths, status: "reserved" },
      {},
      sharedContext
    )
    if (replaced.length > 0) {
      await this.updateUrlEntries(
        replaced.map(({ id }) => ({ id, status: "active" as const })),
        sharedContext
      )
    }
  }

  /**
   * Keeps `path` reserved for its owner after it stops using it, so its
   * redirect stays valid. Returns the status it had: "none" when nobody
   * holds it; another record's path throws `seo.path_not_owned`.
   */
  @InjectTransactionManager()
  async releasePath(
    input: UrlKey & UrlOwner,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PathStatus | "none"> {
    assertUrlKey(input)
    assertUrlOwner(input)
    const [existing] = await this.listUrlEntries(
      { locale: input.locale, path: input.path },
      { take: 1 },
      sharedContext
    )
    if (!existing) {
      return "none"
    }
    if (!isSameOwner(existing, input)) {
      throw pathNotOwnedError()
    }
    if (existing.status === "active") {
      await this.updateUrlEntries({ id: existing.id, status: "reserved" }, sharedContext)
    }
    return existing.status
  }

  /** Reserves every active path of a record that is deleted or unpublished; returns them. */
  @InjectTransactionManager()
  async releasePathsOf(
    owner: UrlOwner,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<UrlKey[]> {
    assertUrlOwner(owner)
    const active = await this.listUrlEntries(
      { entity_type: owner.entity_type, entity_id: owner.entity_id, status: "active" },
      {},
      sharedContext
    )
    if (active.length > 0) {
      await this.updateUrlEntries(
        active.map(({ id }) => ({ id, status: "reserved" as const })),
        sharedContext
      )
    }
    return active.map(({ locale, path }) => ({ locale, path }))
  }

  /**
   * Gives a reserved or active path up for good (its redirect was removed or
   * its 410 period ended), so another record may claim it. Returns whether
   * anything was freed; another record's path throws `seo.path_not_owned`.
   */
  @InjectTransactionManager()
  async freePath(
    input: UrlKey & UrlOwner,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    assertUrlKey(input)
    assertUrlOwner(input)
    const [existing] = await this.listUrlEntries(
      { locale: input.locale, path: input.path },
      { take: 1 },
      sharedContext
    )
    if (!existing) {
      return false
    }
    if (!isSameOwner(existing, input)) {
      throw pathNotOwnedError()
    }
    await this.softDeleteUrlEntries([existing.id], {}, sharedContext)
    return true
  }

  /** Who holds `path`, or null; a path that could never be stored resolves to null. */
  @InjectManager()
  async resolvePath(
    key: UrlKey,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ResolvedPath | null> {
    if (!isUrlKey(key)) {
      return null
    }
    const [entry] = await this.listUrlEntries(
      { locale: key.locale, path: key.path },
      { take: 1 },
      sharedContext
    )
    return entry
      ? { status: entry.status, entity_type: entry.entity_type, entity_id: entry.entity_id }
      : null
  }
}

export default UrlRegistryModuleService
