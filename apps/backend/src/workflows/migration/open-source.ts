import { createHash } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { createShopifyApi, shopifyCredentialsOf } from "../../lib/migration/shopify/client"
import { openShopifySource } from "../../lib/migration/shopify/source"
import { fakeOrigin, fetchOwnersFile } from "../../lib/migration/fetch"
import { bundleSource } from "../../lib/migration/sources/bundle"
import { customerSheetSource } from "../../lib/migration/sources/customer-sheet"
import { MAX_FEED_BYTES, feedSource } from "../../lib/migration/sources/merchant-feed"
import { recordsSource, wordpressRecords, wxrText } from "../../lib/migration/sources/wordpress"
import type { WordpressSummary } from "../../lib/migration/sources/wordpress"
import { legacySummaries } from "../../lib/migration/sources/wordpress/legacy-summary"
import { readWxr } from "../../lib/migration/sources/wordpress/reader"
import type { SummaryDoc } from "../../lib/catalog/summary"
import type { MigrationSource } from "../../lib/migration/types"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"

type Container = Pick<MedusaContainer, "resolve">

export type SourceInput =
  | { source: "bundle"; source_file_id: string }
  | { source: "shopify" }
  | { source: "feed"; feed_url: string }
  | { source: "customers"; source_file_id: string }
  | { source: "wordpress"; source_file_id: string; category_base?: string | null }

/**
 * The run's source, opened (adr/0042 §1, §9): an uploaded bundle or
 * WordPress export read whole (its digest for the audit log), the old site's product feed at
 * the address the owner gave, or the shop's Shopify store through the
 * account the owner connected. `beat` keeps the job alive meanwhile. A
 * WordPress export also gives the job summary's `wordpress` block (its
 * descriptive attributes, what does not move).
 */
export async function openSource(
  container: Container,
  input: SourceInput,
  beat: () => Promise<void>
): Promise<{
  source: MigrationSource
  digest: string | null
  wordpress?: WordpressSummary
  /** What the 2026-11-05 build wrote as short descriptions (summaries.ts); a WordPress export's only. */
  legacy: () => ReadonlyMap<string, SummaryDoc>
}> {
  const none = () => new Map<string, SummaryDoc>()
  if (input.source === "bundle" || input.source === "customers") {
    const buffer = await container.resolve(Modules.FILE).getAsBuffer(input.source_file_id)
    return {
      source: input.source === "bundle" ? bundleSource(buffer) : await customerSheetSource(buffer),
      digest: createHash("sha256").update(buffer).digest("hex"),
      legacy: none,
    }
  }
  if (input.source === "wordpress") {
    const buffer = await container.resolve(Modules.FILE).getAsBuffer(input.source_file_id)
    const text = await wxrText(buffer)
    await beat()
    const records = wordpressRecords(text, { categoryBase: input.category_base ?? null })
    return {
      source: recordsSource(records),
      digest: createHash("sha256").update(buffer).digest("hex"),
      wordpress: records.summary,
      legacy: () => legacySummaries(readWxr(text)),
    }
  }
  if (input.source === "feed") {
    const bytes = await fetchOwnersFile(input.feed_url, {
      key: "migration.feed",
      maxBytes: MAX_FEED_BYTES,
      timeoutMs: 120_000,
      fake: fakeOrigin(),
    })
    await beat()
    // The feed's own host names the source: a run again from it finds what it made
    return {
      source: feedSource(bytes.toString("utf8"), `feed:${new URL(input.feed_url).hostname}`),
      digest: null,
      legacy: none,
    }
  }
  const account = await container
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .read("shopify")
  const credentials = account ? shopifyCredentialsOf(account) : null
  if (!credentials) {
    throw new ValidationError("migration.shopify_not_connected")
  }
  return {
    source: await openShopifySource(createShopifyApi(credentials), credentials.shopDomain, {
      beat,
    }),
    digest: null,
    legacy: none,
  }
}
