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
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"
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

const LIVE = [
  { entity: "product", type: CATALOG_ENTITY_TYPES.product, filters: { status: "published" } },
  {
    entity: "product_category",
    type: CATALOG_ENTITY_TYPES.category,
    filters: { is_active: true, is_internal: false },
  },
  { entity: "brand", type: CATALOG_ENTITY_TYPES.brand, filters: { is_active: true } },
  { entity: "product_collection", type: CATALOG_ENTITY_TYPES.collection, filters: {} },
] as { entity: string; type: string; filters: Record<string, unknown> }[]

/** Active paths of live records changed since `since`, and paths reserved since then. */
export async function changedPaths(container: MedusaContainer, since: Date): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const paths: string[] = []
  for (const spec of LIVE) {
    for (let skip = 0; paths.length < MAX_PATHS; skip += PAGE) {
      const { data } = await query.graph({
        entity: spec.entity,
        fields: ["id"],
        filters: { ...spec.filters, updated_at: { $gt: since } },
        pagination: { skip, take: PAGE, order: { id: "ASC" } },
      })
      const ids = (data as { id: string }[]).map((row) => row.id)
      if (ids.length > 0) {
        const entries = await registry.listUrlEntries(
          { locale: CATALOG_LOCALE, entity_type: spec.type, entity_id: ids, status: "active" },
          { select: ["path"] }
        )
        paths.push(...entries.map((entry) => entry.path))
      }
      if (ids.length < PAGE) {
        break
      }
    }
  }
  const given = await registry.listUrlEntries(
    { locale: CATALOG_LOCALE, status: "reserved", updated_at: { $gt: since } },
    { select: ["path"], take: MAX_PATHS }
  )
  paths.push(...given.map((entry) => entry.path))
  return paths.slice(0, MAX_PATHS)
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
