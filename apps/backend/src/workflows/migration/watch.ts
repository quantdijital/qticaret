import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { notificationText } from "../../lib/notifications/messages"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { SEO_REDIRECTS_MODULE } from "../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../modules/seo-redirects/service"

type Container = Pick<MedusaContainer, "resolve">

/** How long after cutover the storefront's 404s are watched (adr/0042 §8). */
export const WATCH_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
// 404 paths read per look, the most asked first
const MAX_PATHS = 1000

/** The latest cutover, and until when it is watched. */
export async function currentCutover(container: Container) {
  const [cutover] = await container
    .resolve<MigrationModuleService>(MIGRATION_MODULE)
    .listMigrationCutovers({}, { take: 1, order: { cutover_at: "DESC" } })
  return cutover
    ? { ...cutover, watch_until: new Date(cutover.cutover_at.getTime() + WATCH_DAYS * DAY_MS) }
    : null
}

/**
 * The storefront's 404s since the last look, while cutover is watched
 * (F14.7, KK3's after): every one joins the address inventory for the
 * owner to decide, and the bell rings, naming how many were the old
 * site's known addresses. Nothing outside the thirty days.
 */
export async function watchNotFound(container: Container, now: Date = new Date()) {
  const cutover = await currentCutover(container)
  if (!cutover || now > cutover.watch_until) {
    return null
  }
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const since = cutover.watched_at ?? cutover.cutover_at
  const seen = await container
    .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
    .listSeoNotFounds(
      { last_seen_at: { $gt: since } },
      { select: ["path", "hits"], take: MAX_PATHS, order: { hits: "DESC" } }
    )
  let known = 0
  if (seen.length > 0) {
    const listed = await migration.listMigrationUrls(
      { path: seen.map((row) => row.path) },
      { select: ["path"] }
    )
    known = new Set(listed.map((row) => row.path)).size
    await migration.addUrls(
      seen.map((row) => ({ address: row.path, path: row.path, query: null, origin: "not_found" }))
    )
    await container
      .resolve(Modules.NOTIFICATION)
      .createNotifications({
        to: "",
        channel: "feed",
        template: "admin-ui",
        trigger_type: "migration.not_found_seen",
        resource_id: cutover.id,
        data: {
          kind: "migration_not_found",
          count: seen.length,
          known,
          ...notificationText("migration.not_found_seen", { count: seen.length, known }),
        },
      })
      .catch((error: unknown) => {
        logger.warn({ event: "migration.watch_alert_failed", err: errorSummary(error) })
      })
  }
  await migration.updateMigrationCutovers({ id: cutover.id, watched_at: now })
  return { paths: seen.length, known }
}
