import type { MedusaContainer } from "@medusajs/framework/types"
import { parseEnv } from "../../lib/env"
import { ValidationError } from "../../lib/errors"
import { oldAddressOf } from "../../lib/migration/addresses"
import {
  MAX_SITEMAP_BYTES,
  onSite,
  searchConsolePages,
  sitemapEntries,
  sitemapText,
} from "../../lib/migration/old-site"
import type { StepProgress } from "../../lib/migration/types"
import { isSafeFetchError, safeFetch } from "../../lib/security/safe-fetch"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import type { InventoryUrl } from "../../modules/migration/service"

type Container = Pick<MedusaContainer, "resolve">

const FETCH_TIMEOUT_MS = 30_000
// An index and its sitemaps; a shop's addresses well past any we migrate
const MAX_FILES = 50
const MAX_ADDRESSES = 100_000

/**
 * A sitemap file of the old site, under the SSRF rules (docs/04): public
 * addresses only, every redirect checked again, the protocol's size. A
 * fake provider's own origin (development, tests) is reached directly.
 */
async function fetchSitemap(url: URL, fake: string | undefined): Promise<Buffer> {
  try {
    if (fake && new URL(fake).origin === url.origin) {
      const answer = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (answer.status !== 200) {
        throw new ValidationError("migration.sitemap_unreachable", { field: "url" })
      }
      return Buffer.from(await answer.arrayBuffer())
    }
    const answer = await safeFetch(url, {
      timeoutMs: FETCH_TIMEOUT_MS,
      maxResponseBytes: MAX_SITEMAP_BYTES,
      maxRedirects: 3,
      redirect: "follow",
    })
    if (answer.status !== 200) {
      throw new ValidationError("migration.sitemap_unreachable", { field: "url" })
    }
    return answer.body
  } catch (error) {
    if (isSafeFetchError(error)) {
      throw new ValidationError(
        error.reason === "address_not_allowed" || error.reason === "protocol_not_allowed"
          ? "migration.sitemap_address_refused"
          : "migration.sitemap_unreachable",
        { field: "url" }
      )
    }
    throw error
  }
}

/** Addresses into the inventory in groups; how many it took. */
async function keep(container: Container, urls: InventoryUrl[]): Promise<number> {
  await container.resolve<MigrationModuleService>(MIGRATION_MODULE).addUrls(urls)
  return urls.length
}

/**
 * The old site's sitemap into the address inventory (F14.7): an index and
 * the sitemaps it names on the same site, their addresses on the same
 * site only (a sitemap may name another's). What it read.
 */
export async function importSitemap(
  container: Container,
  address: string,
  progress: StepProgress,
  fake: string | undefined = parseEnv().SHOPIFY_BASE_URL
): Promise<{ files: number; addresses: number; elsewhere: number }> {
  let site: URL
  try {
    site = new URL(address)
  } catch {
    throw new ValidationError("migration.sitemap_address_refused", { field: "url" })
  }
  const queue = [site.href]
  const seen = new Set<string>()
  const found = new Map<string, InventoryUrl>()
  let elsewhere = 0
  while (queue.length > 0 && seen.size < MAX_FILES && found.size < MAX_ADDRESSES) {
    const next = queue.shift() ?? ""
    if (seen.has(next)) {
      continue
    }
    seen.add(next)
    const { index, locs } = sitemapEntries(sitemapText(await fetchSitemap(new URL(next), fake)))
    for (const loc of locs) {
      if (!onSite(loc, site)) {
        elsewhere += 1
        continue
      }
      if (index) {
        queue.push(loc)
        continue
      }
      const old = oldAddressOf(loc)
      if (old && found.size < MAX_ADDRESSES) {
        found.set(old.address, { ...old, origin: "sitemap" })
      }
    }
    await progress(seen.size, Math.min(MAX_FILES, seen.size + queue.length))
  }
  return { files: seen.size, addresses: await keep(container, [...found.values()]), elsewhere }
}

/**
 * Search Console's top pages into the inventory, with their clicks (the
 * cutover's top 100, KK3). One address's rows (with and without a slash)
 * add up. How many rows and addresses it took.
 */
export async function importSearchConsole(
  container: Container,
  bytes: Buffer
): Promise<{ rows: number; addresses: number }> {
  const rows = await searchConsolePages(bytes)
  const found = new Map<string, InventoryUrl>()
  for (const row of rows) {
    const old = oldAddressOf(row.url)
    if (old) {
      const clicks = (found.get(old.address)?.clicks ?? 0) + row.clicks
      found.set(old.address, { ...old, origin: "search_console", clicks })
    }
  }
  return { rows: rows.length, addresses: await keep(container, [...found.values()]) }
}
