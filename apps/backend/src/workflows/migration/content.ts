import type { MedusaContainer } from "@medusajs/framework/types"
import type {
  SourceContent,
  SourcePage,
  SourcePost,
  SourcePostTerm,
  StepProgress,
} from "../../lib/migration/types"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import type { RememberedItem } from "../../modules/migration/service"
import type { PostTermsInput } from "../content/term-rules"
import { saveContentWorkflow } from "../content/workflows"
import { ImageRefused, storeImage } from "./images"
import { migratePostTerms, refusalOf, writeSeo } from "./post-terms"
import type { TermCounts } from "./post-terms"
import type { ReportProblem } from "./report"

type Container = Pick<MedusaContainer, "resolve">

export type ContentKinds = "post" | "post_category" | "post_tag" | "page"

/**
 * The old site's blog posts and content pages here (F3.16, adr/0042 Ek
 * 2026-11-03), through the content workflows as the panel saves them: a
 * post filed under its category and tags (made first), its cover picture
 * fetched as a product's are (adr/0042 §7), its first publishing date
 * kept, its SEO fields written. One a run made before, or one of the same
 * handle here, is kept as it is: never written over. A page without text
 * of its own moves only its address, for the owner's decision. A dry run
 * writes nothing and counts what a run would make.
 */
export async function migrateContent(
  container: Container,
  source: string,
  posts: readonly SourcePost[],
  pages: readonly SourcePage[],
  apply: boolean,
  progress: StepProgress
): Promise<{ counts: Record<ContentKinds, TermCounts>; problems: ReportProblem[] }> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const problems: ReportProblem[] = []
  const termsOf = (pick: (post: SourcePost) => (SourcePostTerm | null)[]) => [
    ...new Map(
      posts.flatMap(pick).flatMap((term) => (term ? [[term.source_key, term] as const] : []))
    ).values(),
  ]
  const categories = await migratePostTerms(
    container,
    source,
    "category",
    termsOf((post) => [post.category]),
    apply
  )
  const tags = await migratePostTerms(
    container,
    source,
    "tag",
    termsOf((post) => post.tags),
    apply
  )
  problems.push(
    ...categories.problems.map((problem) => ({ ...problem, kind: "post_category" as const })),
    ...tags.problems.map((problem) => ({ ...problem, kind: "post_tag" as const }))
  )
  const total = posts.length + pages.length
  const entries = [
    ...posts.map((post) => ({
      kind: "post" as const,
      source_key: post.source_key,
      title: post.title,
      content: post.content,
      old_url: post.old_url,
      terms: {
        category_id: post.category ? (categories.ids.get(post.category.source_key) ?? null) : null,
        tag_ids: post.tags.flatMap((tag) => tags.ids.get(tag.source_key) ?? []),
      } satisfies PostTermsInput,
    })),
    ...pages.map((page) => ({
      kind: "page" as const,
      source_key: page.source_key,
      title: page.title,
      content: page.content ?? null,
      old_url: page.old_url,
      terms: undefined,
    })),
  ]
  const counts = {
    post: { read: posts.length, created: 0, found: 0, skipped: 0 },
    page: { read: pages.length, created: 0, found: 0, skipped: 0 },
  }
  const remembered: Record<"post" | "page", RememberedItem[]> = { post: [], page: [] }
  const covers: RememberedItem[] = []
  const found = await existingEntries(container, source, entries)
  for (const [index, entry] of entries.entries()) {
    const own = counts[entry.kind]
    const kept = (item: Omit<RememberedItem, "source_key">) =>
      remembered[entry.kind].push({ source_key: entry.source_key, old_url: entry.old_url, ...item })
    const here = found.get(entry.source_key)
    if (!entry.content) {
      // An address only: the owner decides where it goes (F14.7)
      own.skipped += 1
      kept({ target_id: null, status: "skipped" })
    } else if (here) {
      own.found += 1
      kept({ target_id: here, status: "done" })
    } else if (!apply) {
      own.created += 1
    } else {
      const written = await writeEntry(
        container,
        entry.kind,
        entry.title,
        entry.content,
        entry.terms
      )
      problems.push(
        ...written.problems.map((key) => ({
          kind: key.startsWith("migration.image") ? ("image" as const) : entry.kind,
          source_key: entry.source_key,
          key,
        }))
      )
      if (written.id) {
        own.created += 1
        kept({ target_id: written.id, status: "done" })
        // The cover's old file answers with its new address (adr/0059), as products' pictures do
        if (written.coverId && entry.content.cover) {
          covers.push({
            source_key: `${entry.source_key} ${entry.content.cover.url}`,
            target_id: written.coverId,
            status: "done",
          })
        }
      } else {
        own.skipped += 1
        kept({ target_id: null, status: "skipped", error_code: written.problems[0] ?? null })
      }
    }
    await progress(index + 1, total)
  }
  if (apply) {
    await migration.remember(source, "post", remembered.post)
    await migration.remember(source, "page", remembered.page)
    await migration.remember(source, "image", covers)
  }
  return {
    counts: { ...counts, post_category: categories.counts, post_tag: tags.counts },
    problems,
  }
}

/** Entries here already: the one a run made (and still here), else one of the same kind and handle. */
async function existingEntries(
  container: Container,
  source: string,
  entries: readonly { kind: "post" | "page"; source_key: string; content: SourceContent | null }[]
): Promise<Map<string, string>> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
  const found = new Map<string, string>()
  for (const kind of ["post", "page"] as const) {
    const own = entries.filter((entry) => entry.kind === kind && entry.content)
    const before = await migration.targetsOf(
      source,
      kind,
      own.map((entry) => entry.source_key)
    )
    const rows = await service.listContentEntries(
      { kind, handle: own.map((entry) => entry.content?.handle ?? "") },
      { select: ["id", "handle"], take: null }
    )
    const ids = [...before.values()].flatMap((item) => (item.target_id ? [item.target_id] : []))
    const still = new Set(
      ids.length > 0
        ? (await service.listContentEntries({ id: ids }, { select: ["id"], take: null })).map(
            (row) => row.id
          )
        : []
    )
    const byHandle = new Map(rows.map((row) => [row.handle, row.id]))
    for (const entry of own) {
      const made = before.get(entry.source_key)?.target_id
      const id =
        (made && still.has(made) ? made : null) ?? byHandle.get(entry.content?.handle ?? "")
      if (id) {
        found.set(entry.source_key, id)
      }
    }
  }
  return found
}

/**
 * One post or page through the content workflow: its cover fetched first
 * (one refused leaves it without), its old publishing date kept, its SEO
 * fields after. Its id (and its cover's), or none with why.
 */
async function writeEntry(
  container: Container,
  kind: "post" | "page",
  title: string,
  content: SourceContent,
  terms: PostTermsInput | undefined
): Promise<{ id: string | null; coverId?: string; problems: string[] }> {
  const problems: string[] = []
  let cover: { id: string; url: string; alt: string | null } | null = null
  if (content.cover) {
    try {
      const asset = await storeImage(container, content.cover.url)
      cover = { id: asset.id, url: asset.url, alt: content.cover.alt }
    } catch (error) {
      if (!(error instanceof ImageRefused)) {
        throw error
      }
      problems.push(error.key)
    }
  }
  let id: string
  try {
    const { result } = await saveContentWorkflow(container as MedusaContainer).run({
      input: {
        kind,
        values: {
          title,
          handle: content.handle,
          status: content.status,
          body: content.body,
          excerpt: content.excerpt,
          author_name: content.author,
          image_url: cover?.url ?? null,
          image_alt: cover?.alt ?? null,
        },
        ...(terms ? { terms } : {}),
      },
    })
    id = result.id
  } catch (error) {
    return { id: null, problems: [refusalOf(error), ...problems] }
  }
  if (content.status === "published" && content.published_at) {
    // The workflow dates a first publishing now; the post was live there since
    await container
      .resolve<ContentModuleService>(CONTENT_MODULE)
      .updateContentEntries({ id, published_at: content.published_at })
  }
  const seo = await writeSeo(container, kind, id, {
    seo_title: content.seo_title,
    seo_description: content.seo_description,
    focus_keyword: content.focus_keyword,
    robots_override: content.robots,
  })
  return {
    id,
    ...(cover ? { coverId: cover.id } : {}),
    problems: seo ? [...problems, seo] : problems,
  }
}
