import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { markdownToDoc } from "../../lib/content/markdown"
import { logger } from "../../lib/logging"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import type { SectionName } from "../../modules/platform-settings/sections"
import { MIGRATION_FILE_PREFIX } from "../../workflows/async-job/types/migration-run"
import { runAsyncJobWorkflow } from "../../workflows/async-job/run-async-job"
import { isConflictError } from "../../lib/errors"
import { ASYNC_JOB_MODULE } from "../../modules/async-job"
import type AsyncJobModuleService from "../../modules/async-job/service"
import { deleteContentWorkflow, saveContentWorkflow } from "../../workflows/content/workflows"
import { startMigrationWorkflow } from "../../workflows/migration/start"
import { updatePlatformSettingsWorkflow } from "../../workflows/platform-settings/update-platform-settings"
import { ensureStoreName } from "../bootstrap/store-name"
import { pageBody, profileFile } from "./profile"
import type { LoadedProfile } from "./profile"

/** Each section through its own schema and workflow (adr/0012), as the panel saves it. */
async function applySections(container: MedusaContainer, loaded: LoadedProfile): Promise<void> {
  for (const [section, values] of Object.entries(loaded.profile.sections)) {
    await updatePlatformSettingsWorkflow(container).run({
      input: { section: section as SectionName, values, actor_id: null },
    })
    logger.info({ event: "shop_profile.section_saved", section }, "settings section saved")
  }
}

/** Each page by its handle: made the first time, its title and text replaced after. */
async function applyPages(container: MedusaContainer, loaded: LoadedProfile): Promise<void> {
  const content = container.resolve<ContentModuleService>(CONTENT_MODULE)
  for (const page of loaded.profile.pages) {
    const markdown = pageBody(await profileFile(loaded, page.file))
    const body = markdownToDoc(markdown, {
      siteHost: loaded.profile.site_host ?? null,
      title: page.title,
    })
    const [existing] = await content.listContentEntries(
      { kind: "page", handle: page.handle },
      { select: ["id"], take: 1 }
    )
    await saveContentWorkflow(container).run({
      input: {
        ...(existing ? { id: existing.id } : { kind: "page" as const }),
        values: { title: page.title, handle: page.handle, status: page.status, body },
      },
    })
    logger.info(
      { event: "shop_profile.page_saved", handle: page.handle, made: !existing },
      "content page saved"
    )
  }
}

/** Pages the profile no longer makes, deleted by their handle if present (their paths answer 410). */
async function retirePages(container: MedusaContainer, loaded: LoadedProfile): Promise<void> {
  const handles = loaded.profile.retired_pages
  if (handles.length === 0) {
    return
  }
  const content = container.resolve<ContentModuleService>(CONTENT_MODULE)
  const found = await content.listContentEntries(
    { kind: "page", handle: handles },
    { select: ["id", "handle"] }
  )
  for (const page of found) {
    await deleteContentWorkflow(container).run({ input: page.id })
    logger.info({ event: "shop_profile.page_retired", handle: page.handle }, "content page removed")
  }
}

const POLL_MS = 500
// A job nobody took within this long is run here
const UNCLAIMED_MS = 3000
const LONGEST_MS = 30 * 60 * 1000

/**
 * Waits for a queued job to finish, running it here if no one takes it: a
 * script's own process may take it first (`medusa exec` loads the
 * subscribers too) or, with a Redis event bus, a worker; the script must
 * not end while its process is still running the job.
 */
export async function awaitJob(container: MedusaContainer, id: string): Promise<void> {
  const jobs = container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  const started = Date.now()
  let ranHere = false
  for (;;) {
    const job = await jobs.retrieveAsyncJob(id)
    if (job.status === "succeeded") {
      return
    }
    if (job.status === "failed" || job.status === "cancelled") {
      throw new Error(`shop profile: job ${id} ${job.status} (${job.error_code ?? "no code"})`)
    }
    const waited = Date.now() - started
    if (job.status === "queued" && !ranHere && waited > UNCLAIMED_MS) {
      ranHere = true
      try {
        await runAsyncJobWorkflow(container).run({
          input: { id },
          context: { transactionId: `async-job-run:${id}` },
        })
      } catch (error) {
        // Taken meanwhile: its runner finishes it, the loop waits for that
        if (!(isConflictError(error) && error.safeMessage === "async_job.not_queued")) {
          throw error
        }
      }
      continue
    }
    if (waited > LONGEST_MS) {
      throw new Error(`shop profile: job ${id} still ${job.status} after 30 minutes`)
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

/**
 * The bundle as the panel's upload stores it, then a migration run that
 * applies it (F14): categories, brands and old addresses with their 301s.
 */
async function queueBundle(container: MedusaContainer, loaded: LoadedProfile): Promise<void> {
  if (!loaded.profile.bundle) {
    return
  }
  const bytes = Buffer.from(await profileFile(loaded, loaded.profile.bundle), "utf8")
  const upload = await container.resolve(Modules.FILE).getUploadStream({
    filename: `${MIGRATION_FILE_PREFIX}${randomUUID()}.json`,
    mimeType: "application/json",
    access: "private",
  })
  upload.writeStream.end(bytes)
  await upload.promise
  const { result } = await startMigrationWorkflow(container).run({
    input: {
      source: "bundle",
      source_file_id: upload.fileKey,
      mode: "apply",
      defaults: null,
      requested_by: null,
    },
  })
  logger.info({ event: "shop_profile.bundle_queued", job: result.id }, "migration run queued")
  await awaitJob(container, result.id)
  logger.info({ event: "shop_profile.bundle_applied", job: result.id }, "migration run done")
}

/** The whole profile: name, settings, retired then current pages, the migration run. Safe to run again. */
export async function applyProfile(
  container: MedusaContainer,
  loaded: LoadedProfile
): Promise<void> {
  if (loaded.profile.store_name) {
    await ensureStoreName(container, loaded.profile.store_name)
  }
  await applySections(container, loaded)
  await retirePages(container, loaded)
  await applyPages(container, loaded)
  await queueBundle(container, loaded)
}
