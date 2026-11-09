import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../lib/clients"
import type { Transport } from "../../lib/clients"
import { INDEXNOW_ENDPOINT, indexNowPayloads } from "../../lib/seo/indexnow"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { SEO_INDEXNOW } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { SEO_SITEMAPS_MODULE } from "../../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../../modules/seo-sitemaps/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_LOCALE } from "../catalog/entity-paths"
import { LIVE_RECORDS, keptRows, liveFieldsOf, liveOwnerKeys } from "./live-records"
import type { LiveSpec } from "./live-records"
import { shopOf } from "./payload-sources"

/**
 * Announcing changed pages to IndexNow (docs/13 §6, F3.15): the live pages
 * changed since the last call and the paths given up since then (moved or
 * gone), in one call per 10,000 URLs. Nothing goes out while the flag is
 * off, the shop has no main domain, or this instance is kept out of search.
 */

const PAGE = 1_000
// A long outage does not turn into a whole catalog: at most this far back
const MAX_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000
// The first run announces the last day's changes, not every page
const FIRST_LOOKBACK_MS = 24 * 60 * 60 * 1000
const MAX_PATHS = 50_000

/** The active paths of the live records of one kind changed since `since`. */
async function changedOf(
  container: MedusaContainer,
  spec: LiveSpec,
  since: Date,
  room: number
): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const filters = { ...(await spec.filters(container)), updated_at: { $gt: since } }
  const paths: string[] = []
  for (let skip = 0; paths.length < room; skip += PAGE) {
    const { data } = await query.graph({
      entity: spec.entity,
      fields: liveFieldsOf(spec),
      filters,
      pagination: { skip, take: PAGE, order: { id: "ASC" } },
    })
    const ids = keptRows(spec, data as { id: string }[]).map((row) => row.id)
    if (ids.length > 0) {
      const entries = await registry.listUrlEntries(
        { locale: CATALOG_LOCALE, entity_type: spec.type, entity_id: ids, status: "active" },
        { select: ["path"] }
      )
      paths.push(...entries.map((entry) => entry.path))
    }
    if (data.length < PAGE) {
      break
    }
  }
  return paths
}

/**
 * Active paths of live records changed since `since`; paths claimed since
 * whose record did not change (a category moved: the categories and the
 * landing pages below it); and paths reserved since then.
 */
export async function changedPaths(container: MedusaContainer, since: Date): Promise<string[]> {
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const paths = new Set<string>()
  for (const spec of LIVE_RECORDS) {
    for (const path of await changedOf(container, spec, since, MAX_PATHS - paths.size)) {
      paths.add(path)
    }
  }
  const [claimed, given] = await Promise.all(
    (["active", "reserved"] as const).map((status) =>
      registry.listUrlEntries(
        { locale: CATALOG_LOCALE, status, updated_at: { $gt: since } },
        { select: ["path", "entity_type", "entity_id"], take: MAX_PATHS }
      )
    )
  )
  const live = await liveOwnerKeys(container, claimed ?? [])
  for (const entry of claimed ?? []) {
    if (live.has(`${entry.entity_type}:${entry.entity_id}`)) {
      paths.add(entry.path)
    }
  }
  for (const entry of given ?? []) {
    paths.add(entry.path)
  }
  return [...paths].slice(0, MAX_PATHS)
}

export type AnnounceOutcome =
  { sent: number } | { skipped: "flag_off" | "host_missing" | "indexing_off" | "nothing_changed" }

/** Sends what changed since the last call; the clock moves on only once every call went through. */
export async function announceChanges(
  container: MedusaContainer,
  { transport, now = new Date() }: { transport?: Transport; now?: Date } = {}
): Promise<AnnounceOutcome> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  if (!(await settings.isFeatureEnabled(SEO_INDEXNOW))) {
    return { skipped: "flag_off" }
  }
  const shop = await shopOf(container)
  if (!shop.indexing) {
    return { skipped: "indexing_off" }
  }
  if (!shop.canonicalHost) {
    return { skipped: "host_missing" }
  }
  const sitemaps = container.resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE)
  const state = await sitemaps.currentState()
  const last = state?.indexnow_pinged_at ? new Date(state.indexnow_pinged_at).getTime() : null
  const since = new Date(
    Math.max(last ?? now.getTime() - FIRST_LOOKBACK_MS, now.getTime() - MAX_LOOKBACK_MS)
  )
  const paths = await changedPaths(container, since)
  if (paths.length === 0) {
    await sitemaps.markIndexNowPinged(now)
    return { skipped: "nothing_changed" }
  }
  const client = createHttpClient({
    provider: "indexnow",
    baseUrl: INDEXNOW_ENDPOINT,
    timeoutMs: 10_000,
    ...(transport ? { transport } : {}),
  })
  const payloads = indexNowPayloads(shop.canonicalHost, await sitemaps.indexNowKey(), paths)
  for (const payload of payloads) {
    await client.request({
      method: "POST",
      path: "/indexnow",
      json: payload,
      // The same list twice is harmless: a retry is safe
      idempotent: true,
      schema: z.unknown(),
    })
  }
  await sitemaps.markIndexNowPinged(now)
  return { sent: payloads.reduce((total, payload) => total + payload.urlList.length, 0) }
}
