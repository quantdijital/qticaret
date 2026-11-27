import type { MedusaContainer } from "@medusajs/framework/types"
import type { ContentDoc } from "../../lib/content"
import { contentDoc } from "../../lib/content"
import { errorSummary, logger } from "../../lib/logging"
import { imageSources, insertImages } from "../../lib/migration/body-images"
import { MIGRATION_KINDS } from "../../lib/migration/types"
import type {
  MigrationSource,
  SourcePost,
  StepProblem,
  StepProgress,
} from "../../lib/migration/types"
import type { SheetCell } from "../../lib/sheets"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { saveContentWorkflow } from "../content/workflows"
import { BodyImages, bodyImageKey } from "./content-images"
import type { ImageCounts } from "./images"
import { emptyCounts } from "./report"
import type { KindCounts, ReportProblem, RunCounts } from "./report"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A refresh run for the pictures in moved blog posts' texts (adr/0042 Ek
 * 2026-11-27, `refresh: ["post_images"]`): a run before this change left
 * them out. For each post of the export a run moved before, the pictures
 * its text had there and no run stored yet are stored here
 * (`content-images.ts`) and put into the post's text as it is now, each
 * after the text it followed (`insertImages`): the owner's edits and the
 * rewritten links stay, nothing else of the post changes, nor its
 * revision date. Run again, it stores and adds nothing twice; a picture
 * the owner took out after it was added stays out. Pages keep their text
 * in the theme editor's sections and are not refreshed.
 *
 * `post`: `updated` given pictures (would be), `found` none left to add,
 * `skipped` not moved before or without pictures, `failed` gone or its
 * save refused. `image`: the pictures read, stored, stored before, not stored.
 */
export async function refreshPostImages(
  container: Container,
  sourceId: string,
  posts: readonly SourcePost[],
  apply: boolean,
  progress: StepProgress
): Promise<{ post: KindCounts; image: ImageCounts; problems: ReportProblem[] }> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
  const post: KindCounts = { ...emptyCounts(), read: posts.length }
  const image: ImageCounts = { read: 0, created: 0, found: 0, skipped: 0 }
  const problems: ReportProblem[] = []
  const targets = await migration.targetsOf(
    sourceId,
    "post",
    posts.map((each) => each.source_key)
  )
  const bodyImages = new BodyImages(container, sourceId)
  for (const [index, each] of posts.entries()) {
    await progress(index, posts.length)
    const target = targets.get(each.source_key)
    const id = target?.status === "done" ? target.target_id : null
    const files = imageSources(each.content.body)
    if (!id || files.length === 0) {
      post.skipped += 1
      continue
    }
    const [entry] = await service.listContentEntries(
      { id, kind: "post" },
      { select: ["id", "body", "revised_at"], take: 1 }
    )
    if (!entry) {
      post.failed += 1
      problems.push({ kind: "post", source_key: each.source_key, key: "migration.post_gone" })
      continue
    }
    const before = await migration.targetsOf(
      sourceId,
      "image",
      files.map((url) => bodyImageKey(each.source_key, url))
    )
    // A picture a run stored (and maybe the owner took out since) is not added again
    const pending = files.filter(
      (url) => before.get(bodyImageKey(each.source_key, url))?.status !== "done"
    )
    image.read += files.length
    image.found += files.length - pending.length
    if (pending.length === 0) {
      post.found += 1
      continue
    }
    if (!apply) {
      post.updated += 1
      image.created += pending.length
      continue
    }
    const pendingDoc: ContentDoc = {
      ...each.content.body,
      content: each.content.body.content.filter(
        (block) => block.type !== "image" || pending.includes(block.attrs.src)
      ),
    }
    const local = await bodyImages.localize(each.source_key, pendingDoc)
    image.created += local.fetched.size
    image.skipped += local.problems.length
    problems.push(...local.problems.map((problem) => ({ ...problem, kind: "image" as const })))
    const problem = await writeBody(container, entry, each, local.stored)
    if (problem) {
      post.failed += 1
      problems.push({ ...problem, kind: "post" })
      continue
    }
    await bodyImages.remember(local.items)
    if (local.stored.size > 0) {
      post.updated += 1
    } else {
      post.skipped += 1
    }
  }
  await progress(posts.length, posts.length)
  return { post, image, problems }
}

/** The post's text with the stored pictures added, its revision date kept; why not, or null. */
async function writeBody(
  container: Container,
  entry: { id: string; body: unknown; revised_at: Date | null },
  post: SourcePost,
  stored: ReadonlyMap<string, string>
): Promise<StepProblem | null> {
  if (stored.size === 0) {
    return null
  }
  const failed = { source_key: post.source_key, key: "migration.post_images_failed" }
  const current = contentDoc.safeParse(entry.body)
  if (!current.success) {
    return failed
  }
  const body = insertImages(current.data, post.content.body, stored)
  try {
    await saveContentWorkflow(container as MedusaContainer).run({
      input: { id: entry.id, values: { body } },
    })
  } catch (error) {
    logger.warn({ event: "migration.post_images_failed", err: errorSummary(error) })
    return failed
  }
  // Pictures moved in are no revision of the text
  await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .updateContentEntries({ id: entry.id, revised_at: entry.revised_at })
  return null
}

/** A refresh run's whole work: the source's posts read, their pictures added; nothing else. */
export async function runPostImageRefresh(
  container: Container,
  source: MigrationSource,
  runId: string,
  mode: "check" | "apply",
  progress: (percent: number) => Promise<void>
): Promise<{ counts: RunCounts; productRows: SheetCell[][]; problems: ReportProblem[] }> {
  const posts: SourcePost[] = []
  for await (const each of source.posts?.() ?? []) {
    posts.push(each)
  }
  const refreshed = await refreshPostImages(
    container,
    source.id,
    posts,
    mode === "apply",
    (done, total) => progress(5 + (total > 0 ? done / total : 1) * 95)
  )
  const counts = Object.fromEntries(
    [...MIGRATION_KINDS, "consent", "attribute"].map((kind) => [kind, emptyCounts()])
  ) as RunCounts
  counts.post = refreshed.post
  counts.image = { ...emptyCounts(), ...refreshed.image }
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  await migration.count(runId, "post", { ...refreshed.post })
  await migration.count(runId, "image", { ...refreshed.image })
  await progress(100)
  return { counts, productRows: [], problems: refreshed.problems }
}
