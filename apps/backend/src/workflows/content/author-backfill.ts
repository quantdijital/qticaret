import type { MedusaContainer } from "@medusajs/framework/types"
import { isValidationError } from "../../lib/errors"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { authorsLinkedWorkflow, saveAuthorWorkflow } from "./author-workflows"

/**
 * Blog authors from the names posts had before authors had records
 * (adr/0060, `authors:backfill`): one author per distinct name (spaces
 * collapsed, compared as a Turkish reader would, case aside), an author
 * already named so reused, the posts linked to it. Their old text stays
 * as it was (the fallback until a later cleanup). Without `apply` nothing
 * is written: the plan says what would be. Safe to run again: a post
 * already linked is left alone.
 */

export interface BackfillPlanRow {
  name: string
  /** The author already there under this name, or null for a new one. */
  author_id: string | null
  posts: string[]
}

export interface BackfillResult {
  apply: boolean
  /** Posts with an old author text and no author record. */
  posts: number
  /** Distinct names among them. */
  names: number
  reused: number
  created: number
  linked: number
  plan: BackfillPlanRow[]
  problems: { name: string; key: string }[]
}

const normalName = (raw: string) => raw.trim().replace(/\s+/g, " ")
const keyOf = (name: string) => name.toLocaleLowerCase("tr")

// Posts read and linked at a time
const PAGE = 500

async function unlinkedPosts(service: ContentModuleService) {
  const found: { id: string; author_name: string }[] = []
  for (let skip = 0; ; skip += PAGE) {
    const page = await service.listContentEntries(
      { kind: "post", author_id: null, author_name: { $ne: null } },
      { select: ["id", "author_name"], skip, take: PAGE, order: { id: "ASC" } }
    )
    for (const post of page) {
      const name = normalName(post.author_name ?? "")
      if (name !== "") {
        found.push({ id: post.id, author_name: name })
      }
    }
    if (page.length < PAGE) {
      return found
    }
  }
}

/** The plan, and with `apply` the authors made and the posts linked. */
export async function backfillAuthors(
  container: MedusaContainer,
  { apply }: { apply: boolean }
): Promise<BackfillResult> {
  const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
  const posts = await unlinkedPosts(service)
  const groups = new Map<string, BackfillPlanRow>()
  for (const post of posts) {
    const key = keyOf(post.author_name)
    const group = groups.get(key) ?? { name: post.author_name, author_id: null, posts: [] }
    group.posts.push(post.id)
    groups.set(key, group)
  }
  const authors = await service.listContentAuthors({}, { select: ["id", "name"], take: null })
  const byName = new Map(authors.map((author) => [keyOf(normalName(author.name)), author.id]))
  const plan = [...groups.entries()].map(([key, group]) => ({
    ...group,
    author_id: byName.get(key) ?? null,
  }))
  const result: BackfillResult = {
    apply,
    posts: posts.length,
    names: plan.length,
    reused: plan.filter((row) => row.author_id).length,
    created: 0,
    linked: 0,
    plan,
    problems: [],
  }
  if (!apply) {
    return result
  }
  for (const row of plan) {
    let authorId = row.author_id
    if (!authorId) {
      try {
        // The handle from the name, the first free `-2`, `-3`… when another author has it
        const { result: saved } = await saveAuthorWorkflow(container).run({
          input: { values: { name: row.name } },
        })
        authorId = saved.id
        result.created += 1
      } catch (error) {
        if (!isValidationError(error)) {
          throw error
        }
        result.problems.push({ name: row.name, key: error.safeMessage })
        continue
      }
    }
    for (let start = 0; start < row.posts.length; start += PAGE) {
      const ids = row.posts.slice(start, start + PAGE)
      await service.updateContentEntries(ids.map((id) => ({ id, author_id: authorId })))
      result.linked += ids.length
    }
  }
  if (result.linked > 0) {
    // The posts' structured data and bylines name the authors now
    await authorsLinkedWorkflow(container).run()
  }
  return result
}
