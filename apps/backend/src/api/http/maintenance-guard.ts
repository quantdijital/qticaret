import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, logger } from "../../lib/logging"
import { orderAccessKey } from "../../lib/orders/access-token"
import { bypassOpens, bypassParts } from "../../lib/storefront/maintenance"
import {
  MAINTENANCE_BYPASS_HEADER,
  MAINTENANCE_MESSAGE,
  decideMaintenanceRequest,
  maintenanceRetryAfter,
} from "../../lib/storefront/maintenance-guard"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { MaintenanceSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { maintenanceState } from "../../workflows/storefront/maintenance"
import { rejectRequest } from "./reject"
import { routePath } from "./request-path"

const WARN_EVERY_MS = 60_000
let lastWarning = Number.NEGATIVE_INFINITY

/**
 * The section from the platform settings' cache (adr/0012: invalidated on
 * every save, other processes within a second). Unreadable: null, logged
 * at most once a minute.
 */
async function maintenanceOf(req: MedusaRequest): Promise<MaintenanceSettings | null> {
  try {
    const values: unknown = await req.scope
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .getSection("maintenance")
    return values as MaintenanceSettings
  } catch (error) {
    if (Date.now() - lastWarning >= WARN_EVERY_MS) {
      lastWarning = Date.now()
      logger.warn({ event: "maintenance.guard_unreadable", err: errorSummary(error) })
    }
    return null
  }
}

/**
 * A bypass link's holder, through the storefront: the token is checked as
 * `GET /store/maintenance/bypass/:token` checks it (its signature, its
 * week, the section's version now), so only a link the owner or an admin
 * made opens the shop. A malformed or ended token costs no read.
 */
async function holdsBypass(req: MedusaRequest): Promise<boolean> {
  const sent = req.headers[MAINTENANCE_BYPASS_HEADER]
  const parts = typeof sent === "string" ? bypassParts(sent) : null
  if (!parts) {
    return false
  }
  try {
    const state = await maintenanceState(req.scope)
    return state.enabled && bypassOpens(orderAccessKey(), parts, state.version)
  } catch {
    // An unreadable section opens no link; the guard's own read already said the shop is dark
    return false
  }
}

/**
 * adr/0053 Ek 2026-11-17: while the shop is in maintenance, a Store API
 * write (and a shopper's registration) answers 503 `maintenance.shop_closed`
 * with `Retry-After`, as the storefront's page does, unless
 * `lib/storefront/maintenance-guard.ts` names it open or the caller holds
 * a bypass link. Reads never reach the setting. A setting that cannot be
 * read blocks nothing (fail-open, logged): maintenance is the shop's own
 * pause, enforced first at the storefront's edge, and the write itself
 * needs the same database that just failed.
 */
export async function refuseWritesInMaintenance(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const decision = decideMaintenanceRequest(req.method, routePath(req))
  if (!decision.closed) {
    next()
    return
  }
  const maintenance = await maintenanceOf(req)
  if (!maintenance?.enabled || (await holdsBypass(req))) {
    next()
    return
  }
  res.setHeader("Retry-After", String(maintenanceRetryAfter(maintenance.expected_at)))
  res.setHeader("Cache-Control", "no-store")
  rejectRequest(
    req,
    res,
    503,
    { type: "unavailable", message: MAINTENANCE_MESSAGE },
    decision.reason
  )
}
