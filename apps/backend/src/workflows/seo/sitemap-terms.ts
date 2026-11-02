import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { chunksOf } from "../../lib/catalog"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_LOCALE } from "../catalog/entity-paths"
import { termEntityType } from "../content/paths"
import { postCounts } from "../content/term-reads"

interface TermRow {
  id: string
  kind: "category" | "tag"
  seo_meta?: { robots_override?: string | null; canonical_override?: string | null } | null
}

/**
 * The blog's archives in the sitemap (adr/0019 ek 2026-11-03, the `blog`
 * file): categories and tags with at least one live post, at their active
 * paths, unless marked noindex or canonical elsewhere. An empty archive is
 * noindex, so it stays out.
 */
export async function termSitemapPaths(container: MedusaContainer): Promise<string[]> {
  const live = await postCounts(container, null, { live: true })
  const ids = [...live.keys()]
  const found: string[] = []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  for (const chunk of chunksOf(ids)) {
    const { data } = await query.graph({
      entity: "content_term",
      fields: ["id", "kind", "seo_meta.robots_override", "seo_meta.canonical_override"],
      filters: { id: chunk },
    })
    const rows = (data as TermRow[]).filter(
      (row) =>
        !row.seo_meta?.robots_override?.startsWith("noindex") && !row.seo_meta?.canonical_override
    )
    if (rows.length === 0) {
      continue
    }
    const paths = await registry.listUrlEntries(
      {
        locale: CATALOG_LOCALE,
        entity_type: [...new Set(rows.map((row) => termEntityType(row.kind)))],
        entity_id: rows.map((row) => row.id),
        status: "active",
      },
      { select: ["path"] }
    )
    found.push(...paths.map((entry) => entry.path))
  }
  return found.sort()
}
