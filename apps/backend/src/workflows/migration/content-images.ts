import type { MedusaContainer } from "@medusajs/framework/types"
import type { ContentDoc } from "../../lib/content"
import { errorSummary, logger } from "../../lib/logging"
import { imageSources, swapImages } from "../../lib/migration/body-images"
import { fakeOrigin } from "../../lib/migration/fetch"
import { FetchPace } from "../../lib/migration/fetch-pace"
import type { StepProblem } from "../../lib/migration/types"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import type { RememberedItem } from "../../modules/migration/service"
import { ImageRefused, inTurns, storeImage } from "./images"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The pictures in moved posts' and pages' bodies stored in the media
 * library (adr/0042 Ek 2026-11-27), as products' pictures are: fetched
 * under the SSRF rules (`lib/migration/image-fetch.ts`: public addresses,
 * redirects checked, the upload cap, retried while the host is busy, one
 * pace for the run), checked by their bytes, stored cleaned, with their
 * AVIF/WebP versions. A file is fetched once a run, however many bodies
 * show it; one a run stored before (remembered under `<entry> <file>`) is
 * taken again as it is. A picture refused or out of reach is named in the
 * report and left out of the body; the entry still moves. The remembered
 * keys also give the old file's address its 301 (adr/0059, `legacy-addresses.ts`).
 */

/** The image record a body picture is remembered under. */
export const bodyImageKey = (entryKey: string, url: string) => `${entryKey} ${url}`

type Fetched = { url: string; asset: { id: string; url: string } } | { url: string; key: string }

/** A body with its pictures swapped for the stored copies, and what that took. */
export interface LocalBody {
  doc: ContentDoc
  /** Old file → stored copy's address. */
  stored: Map<string, string>
  /** Files the run fetched for this body now (the rest were stored before). */
  fetched: Set<string>
  /** Files a run stored before. */
  found: number
  problems: StepProblem[]
  /** To remember once the entry is saved. */
  items: RememberedItem[]
}

export class BodyImages {
  private readonly pace = new FetchPace()
  private readonly runs = new Map<string, Promise<Fetched>>()

  constructor(
    private readonly container: Container,
    private readonly source: string,
    private readonly fake: string | undefined = fakeOrigin()
  ) {}

  /** The files a run stored before for this entry and are still in the library: old file → copy. */
  async storedBefore(entryKey: string, urls: readonly string[]): Promise<Map<string, string>> {
    const before = await this.container.resolve<MigrationModuleService>(MIGRATION_MODULE).targetsOf(
      this.source,
      "image",
      urls.map((url) => bodyImageKey(entryKey, url))
    )
    const ids = new Map<string, string>()
    for (const url of urls) {
      const target = before.get(bodyImageKey(entryKey, url))
      if (target?.status === "done" && target.target_id) {
        ids.set(url, target.target_id)
      }
    }
    if (ids.size === 0) {
      return new Map()
    }
    const assets = await this.container
      .resolve<MediaModuleService>(MEDIA_MODULE)
      .listMediaAssets({ id: [...ids.values()] }, { select: ["id", "url"] })
    const urlOf = new Map(assets.map((asset) => [asset.id, asset.url]))
    return new Map(
      [...ids].flatMap(([url, id]) => {
        const copy = urlOf.get(id)
        return copy ? [[url, copy] as const] : []
      })
    )
  }

  private fetch(url: string): Promise<Fetched> {
    let run = this.runs.get(url)
    if (!run) {
      run = storeImage(this.container, url, this.fake, { versions: true, pace: this.pace }).then(
        (asset) => ({ url, asset: { id: asset.id, url: asset.url } }),
        (error: unknown) => {
          if (error instanceof ImageRefused) {
            return { url, key: error.key }
          }
          logger.warn({ event: "migration.body_image_failed", err: errorSummary(error) })
          return { url, key: "migration.image_not_accepted" }
        }
      )
      this.runs.set(url, run)
    }
    return run
  }

  /** The entry's body with its pictures stored here: fetched now, or as a run stored them before. */
  async localize(entryKey: string, doc: ContentDoc): Promise<LocalBody> {
    const urls = imageSources(doc)
    const stored = await this.storedBefore(entryKey, urls)
    const found = stored.size
    const fresh = urls.filter((url) => !stored.has(url))
    const outcomes = await inTurns(fresh, (url) => this.fetch(url))
    const problems: StepProblem[] = []
    const items: RememberedItem[] = []
    const fetched = new Set<string>()
    for (const outcome of outcomes) {
      const source_key = bodyImageKey(entryKey, outcome.url)
      if ("asset" in outcome) {
        stored.set(outcome.url, outcome.asset.url)
        fetched.add(outcome.url)
        items.push({ source_key, target_id: outcome.asset.id, status: "done" })
      } else {
        problems.push({ source_key, key: outcome.key })
        items.push({ source_key, target_id: null, status: "skipped", error_code: outcome.key })
      }
    }
    return { doc: swapImages(doc, stored), stored, fetched, found, problems, items }
  }

  /** The entry's pictures remembered: once it is saved, so a failed save fetches them again. */
  async remember(items: readonly RememberedItem[]): Promise<void> {
    if (items.length > 0) {
      await this.container
        .resolve<MigrationModuleService>(MIGRATION_MODULE)
        .remember(this.source, "image", items)
    }
  }
}
