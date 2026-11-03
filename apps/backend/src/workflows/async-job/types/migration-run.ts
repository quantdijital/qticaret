import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { errorSummary, logger } from "../../../lib/logging"
import { XLSX_MIME, writeXlsx } from "../../../lib/sheets"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { MIGRATION_MODULE } from "../../../modules/migration"
import type MigrationModuleService from "../../../modules/migration/service"
import { openSource } from "../../migration/open-source"
import { reportSheets } from "../../migration/report"
import { runDescriptionRefresh } from "../../migration/descriptions"
import { runMigration } from "../../migration/run"
import type { JobType } from "./types"

/** The name an uploaded migration file is stored under; the job reads no other file. */
export const MIGRATION_FILE_PREFIX = "migration-bundle-"
/** The name an uploaded customer sheet is stored under (F14.3). */
export const CUSTOMER_FILE_PREFIX = "migration-customers-"
/** The name an uploaded WordPress export is stored under (adr/0042 Ek 2026-11-03). */
export const WORDPRESS_FILE_PREFIX = "migration-wordpress-"
/** A product category address base the owner names (`/urun-kategori/`): a path of one segment or none. */
export const CATEGORY_BASE = /^\/?(?:[a-z0-9-]{1,60}\/?)?$/
/**
 * What a WordPress run may refresh alone (adr/0055): `descriptions`, the
 * documents and their plain text of the products a run moved before.
 */
export const REFRESH_KINDS = ["descriptions"] as const

const shared = {
  mode: z.enum(["check", "apply"]),
  // The owner's parcel for a product without measurements: grams and cm
  defaults: z
    .object({
      weight: z.number().positive().max(1_000_000),
      length: z.number().positive().max(10_000),
      width: z.number().positive().max(10_000),
      height: z.number().positive().max(10_000),
    })
    .strict()
    .nullable()
    .default(null),
}

const input = z.discriminatedUnion("source", [
  z
    .object({
      source: z.literal("bundle"),
      source_file_id: z
        .string()
        .min(1)
        .max(512)
        .refine((id) => id.includes(MIGRATION_FILE_PREFIX)),
      ...shared,
    })
    .strict(),
  // The store and its account are the connected one's (integration-credentials), never the input's
  z.object({ source: z.literal("shopify"), ...shared }).strict(),
  // The old platform's customer list (F14.3), a sheet stored as a bundle is
  z
    .object({
      source: z.literal("customers"),
      source_file_id: z
        .string()
        .min(1)
        .max(512)
        .refine((id) => id.includes(CUSTOMER_FILE_PREFIX)),
      ...shared,
    })
    .strict(),
  // A WordPress site's export (WXR): its catalogue, blog and pages, the authors' and commenters' names
  z
    .object({
      source: z.literal("wordpress"),
      source_file_id: z
        .string()
        .min(1)
        .max(512)
        .refine((id) => id.includes(WORDPRESS_FILE_PREFIX)),
      category_base: z.string().max(64).regex(CATEGORY_BASE).nullable().default(null),
      // adr/0055: only this, and nothing else, of what a run moved before
      refresh: z.array(z.enum(REFRESH_KINDS)).max(REFRESH_KINDS.length).default([]),
      ...shared,
    })
    .strict(),
  // The old site's product feed (F14.3), fetched under the SSRF rules
  z
    .object({
      source: z.literal("feed"),
      feed_url: z.url({ protocol: /^https?$/ }).max(2048),
      ...shared,
    })
    .strict(),
])

/** What a `migration.run` job is asked: kept with it, so a run stopped half-way can start again. */
export type MigrationRunInput = z.infer<typeof input>

/**
 * A shop's old platform moved here, or a dry run of it (F14, adr/0042 §9):
 * queued by `POST /admin/migrations` (a bundle or a WordPress export it stored) or
 * `POST /admin/migrations/shopify`, never through the generic jobs route.
 * It writes products, so it runs apart from an import or a bulk edit. A
 * bundle holds the shop's customers: it is deleted however the run ends,
 * and the job and its report are the owner's. A run is kept with its
 * counts as each kind ends; applying is in the audit log as it starts and
 * ends.
 */
export const migrationRun: JobType<z.infer<typeof input>> = {
  input,
  singleton: true,
  group: "catalog.write",
  resultTtlDays: 7,
  // The report names source records by their keys, and a source may key customers by e-mail
  containsPersonalData: true,
  ownerOnly: true,
  internal: true,
  execute: async ({ container, job, progress, resultFile }, values) => {
    const { mode, defaults } = values
    const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
    const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    const run = await migration.createMigrationRuns({
      source: values.source,
      mode,
      job_id: job.id,
      started_by: job.requested_by,
    })
    // The last progress, told again while a source works out of sight: the heartbeat
    let last = 0
    const report = (percent: number) => {
      last = percent
      return progress(percent)
    }
    try {
      const { source, digest, wordpress } = await openSource(container, values, () =>
        progress(last)
      )
      const record = async (action: string, changes: Record<string, unknown>) => {
        await audit.record({
          kind: "system",
          action: `migration.${action}`,
          actor_type: job.requested_by ? "user" : "system",
          actor_id: job.requested_by,
          resource_type: "async_job",
          resource_id: job.id,
          changes: { ...changes, source: source.id, ...(digest ? { file_sha256: digest } : {}) },
        })
      }
      // adr/0055: a refresh run rewrites the moved products' descriptions and nothing else
      const refresh = values.source === "wordpress" ? values.refresh : []
      if (mode === "apply") {
        await record("started", { run_id: run.id, ...(refresh.length > 0 ? { refresh } : {}) })
      }
      const { counts, productRows, problems } = refresh.includes("descriptions")
        ? await runDescriptionRefresh(container, source, run.id, mode, report)
        : await runMigration(container, source, run.id, mode, defaults, {
            progress: report,
            origin: { job_id: job.id, actor_id: job.requested_by },
            audit: (action, changes) =>
              mode === "apply" ? record(action, changes) : Promise.resolve(),
          })
      if (mode === "apply") {
        await record("finished", { run_id: run.id, counts })
      }
      const file = await resultFile(`gecis-rapor-${randomUUID()}.xlsx`, XLSX_MIME)
      for await (const chunk of writeXlsx(reportSheets(mode, counts, productRows, problems))) {
        await file.write(chunk as Buffer)
      }
      await migration.updateMigrationRuns({ id: run.id, status: "done", finished_at: new Date() })
      // A WordPress run's block: its descriptive attributes and what does not move (the panel's)
      return {
        summary: {
          run_id: run.id,
          mode,
          counts,
          ...(refresh.length > 0 ? { refresh } : wordpress ? { wordpress } : {}),
        },
      }
    } catch (error) {
      await migration
        .updateMigrationRuns({ id: run.id, status: "failed", finished_at: new Date() })
        .catch(() => undefined)
      throw error
    } finally {
      // A file holds the shop's customers: gone however the run ended
      if (
        values.source === "bundle" ||
        values.source === "customers" ||
        values.source === "wordpress"
      ) {
        await container
          .resolve(Modules.FILE)
          .deleteFiles(values.source_file_id)
          .catch((error: unknown) => {
            logger.warn({ event: "migration.source_kept", jobId: job.id, err: errorSummary(error) })
          })
      }
    }
  },
}
