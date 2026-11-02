import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { containsPattern } from "../../../../lib/security"
import { CONTENT_MODULE } from "../../../../modules/content"
import type ContentModuleService from "../../../../modules/content/service"
import type { ContentTermRecord } from "../../../../modules/content/service"
import { postCounts } from "../../../../workflows/content/term-reads"
import { termPath } from "../../../../workflows/content/term-rules"
import type { AdminGetContentTermsType } from "./validators"

type Term = Pick<
  ContentTermRecord,
  "id" | "kind" | "name" | "handle" | "description" | "rank" | "created_at" | "updated_at"
>

const FIELDS = [
  "id",
  "kind",
  "name",
  "handle",
  "description",
  "rank",
  "created_at",
  "updated_at",
] as const

/** A term as the panel shows it, with how many posts (drafts too) and live posts it files. */
const shown = (term: Term, posts: Map<string, number>, live: Map<string, number>) => ({
  id: term.id,
  kind: term.kind,
  name: term.name,
  handle: term.handle,
  path: termPath(term),
  description: term.description,
  rank: term.rank,
  post_count: posts.get(term.id) ?? 0,
  live_post_count: live.get(term.id) ?? 0,
  created_at: term.created_at,
  updated_at: term.updated_at,
})

async function counted(container: MedusaContainer, terms: Term[]) {
  const ids = terms.map((term) => term.id)
  const [posts, live] = ids.length
    ? await Promise.all([
        postCounts(container, ids, { live: false }),
        postCounts(container, ids, { live: true }),
      ])
    : [new Map<string, number>(), new Map<string, number>()]
  return terms.map((term) => shown(term, posts, live))
}

/** A page of a blog's categories or tags by name, in the shop's order (rank, then name). */
export async function readTermList(container: MedusaContainer, query: AdminGetContentTermsType) {
  const [terms, count] = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listAndCountContentTerms(
      {
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.q ? { name: { $ilike: containsPattern(query.q) } } : {}),
      },
      {
        select: [...FIELDS],
        skip: query.offset,
        take: query.limit,
        order: { kind: "ASC", rank: "ASC", name: "ASC" },
      }
    )
  return {
    terms: await counted(container, terms),
    count,
    offset: query.offset,
    limit: query.limit,
  }
}

export async function readTerm(container: MedusaContainer, id: string) {
  const [term] = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentTerms({ id }, { select: [...FIELDS], take: 1 })
  if (!term) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.term_unknown")
  }
  const [shownTerm] = await counted(container, [term])
  return shownTerm
}
