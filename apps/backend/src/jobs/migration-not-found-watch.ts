import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { watchNotFound } from "../workflows/migration/watch"

/** The storefront's 404s in the thirty days after a migration's cutover (F14.7). */
export default async function migrationNotFoundWatch(container: MedusaContainer) {
  const watched = await watchNotFound(container)
  if (watched && watched.paths > 0) {
    logger.info({ event: "migration.not_found_watched", ...watched })
  }
}

export const config = {
  name: "migration-not-found-watch",
  // Each morning: yesterday's 404s, after the night's counter flushes
  schedule: "20 6 * * *",
}
