import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { isLocalEnv, parseEnv } from "../lib/env"
import { logger } from "../lib/logging"
import { looksLikeWxr, wordpressRecords, wxrText } from "../lib/migration/sources/wordpress"
import { readZipSafely } from "../lib/security/zip"
import { ASYNC_JOB_MODULE } from "../modules/async-job"
import type AsyncJobModuleService from "../modules/async-job/service"
import { WORDPRESS_FILE_PREFIX } from "../workflows/async-job/types/migration-run"
import { startMigrationWorkflow } from "../workflows/migration/start"
import { awaitJob } from "./shop-profile/apply"

/**
 * Usage: NODE_ENV=development pnpm --filter @qticaret/backend medusa exec
 *   ./src/scripts/wordpress-check.ts <export.xml> [category-base]
 *
 * A dry run of a WordPress export (adr/0042 Ek 2026-11-03) as the panel
 * starts one: the file stored as the upload stores it, a `migration.run`
 * check job, then its counts by kind, the archives' bases, the notes by
 * reason and the descriptive attributes. Writes nothing but the run's own
 * record and report; never applies. Prints no record of a person (keys and
 * counts only). Development and test only.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  if (!isLocalEnv(parseEnv())) {
    throw new Error("wordpress check: development or test only")
  }
  const [file, categoryBase] = args
  if (!file) {
    throw new Error("wordpress check: name the export file")
  }
  const bytes = await readFile(path.resolve(file))
  if (!looksLikeWxr(bytes)) {
    throw new Error("wordpress check: not a WordPress export")
  }
  const upload = await container.resolve(Modules.FILE).getUploadStream({
    filename: `${WORDPRESS_FILE_PREFIX}${randomUUID()}.xml`,
    mimeType: "application/xml",
    access: "private",
  })
  upload.writeStream.end(bytes)
  await upload.promise
  const { result } = await startMigrationWorkflow(container).run({
    input: {
      source: "wordpress",
      source_file_id: upload.fileKey,
      category_base: categoryBase ?? null,
      mode: "check",
      defaults: null,
      requested_by: null,
    },
  })
  await awaitJob(container, result.id)
  const jobs = container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  const job = await jobs.retrieveAsyncJob(result.id)
  // The report's product rows: the catalog import's outcome, the SEO advisor's codes
  const report = await container.resolve(Modules.FILE).getAsBuffer(job.result_file_id ?? "")
  const sheets = await readZipSafely(report)
  const rows =
    sheets.find((entry) => entry.name === "xl/worksheets/sheet2.xml")?.data.toString("utf8") ?? ""
  const outcomes = new Map<string, number>()
  const advice = new Map<string, number>()
  const tally = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1)
  for (const row of rows.split("<row").slice(2)) {
    const cells = [...row.matchAll(/<t xml:space="preserve">([^<]*)<\/t>/g)].map((m) => m[1] ?? "")
    tally(outcomes, cells[1] ?? "")
    for (const code of (cells.at(-1) ?? "").split(", ").filter((each) => each.startsWith("P-"))) {
      tally(advice, code)
    }
  }
  const records = wordpressRecords(await wxrText(bytes), { categoryBase: categoryBase ?? null })
  const notes = new Map<string, number>()
  for (const note of records.notes) {
    const key = `${note.kind} ${note.key}`
    notes.set(key, (notes.get(key) ?? 0) + 1)
  }
  logger.info(
    {
      event: "wordpress_check.done",
      job: job.id,
      status: job.status,
      source: records.id,
      bases: records.bases,
      counts: (job.result_summary as { counts?: unknown } | null)?.counts ?? null,
      product_rows: Object.fromEntries(outcomes),
      seo_advice: Object.fromEntries([...advice].sort((a, b) => b[1] - a[1])),
      notes: Object.fromEntries([...notes].sort((a, b) => b[1] - a[1])),
      attributes: [...records.attributes].map(([key, use]) => ({
        key,
        name: use.name,
        products: use.products,
        values: [...use.values].slice(0, 30),
      })),
      options: [...new Set(records.products.flatMap((p) => p.options.map((o) => o.name)))],
    },
    "wordpress export checked"
  )
}
