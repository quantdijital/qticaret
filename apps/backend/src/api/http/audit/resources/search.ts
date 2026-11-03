import { SEARCH_INDEX_MODULE } from "../../../../modules/search-index"
import type SearchIndexModuleService from "../../../../modules/search-index/service"
import type { AuditedResource, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Site search's synonym groups (adr/0056, adr/0011): a group's terms
 * before and after. A new group has no before.
 */

async function byId(scope: Resolver, id: string): Promise<Snapshot> {
  const index = scope.resolve(SEARCH_INDEX_MODULE) as SearchIndexModuleService
  const [group] = await index.listSearchSynonyms({ id }, { take: 1 })
  return group ? { terms: group.terms } : {}
}

export const SEARCH_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/search/synonyms",
    pattern: /^\/admin\/search\/synonyms$/i,
    resourceType: "search_synonym",
    resourceId: () => null,
    snapshot: () => Promise.resolve({}),
  },
  ...(["POST", "DELETE"] as const).map((method) => ({
    method,
    route: `${method} /admin/search/synonyms/:id`,
    pattern: new RegExp(`^/admin/search/synonyms/(?<id>${ID})$`, "i"),
    resourceType: "search_synonym",
    resourceId: (params: Record<string, string>) => params["id"] ?? null,
    snapshot: ({ scope, params }: { scope: Resolver; params: Record<string, string> }) =>
      byId(scope, params["id"] ?? ""),
  })),
]
