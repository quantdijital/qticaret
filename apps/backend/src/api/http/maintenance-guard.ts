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

interface SectionState {
  enabled: boolean
  version: number
}

const WARN_EVERY_MS = 60_000
let lastWarning = Number.NEGATIVE_INFINITY
// The last section read: what a failed read falls back on (security review L1)
let lastKnown: MaintenanceSettings | null = null
/**
 * The section's stored version, once per cached section value (security
 * review L2): the settings cache hands out a new object after every save and
 * every reload, so a save ends old links as soon as the cache sees it, and
 * any number of well-formed tokens costs one database read per snapshot.
 */
const versions = new WeakMap<object, Promise<SectionState>>()

/**
 * The section from the platform settings' cache (adr/0012: invalidated on
 * every save, other processes within a second). When a read fails the last
 * one read stands; with none ever read, null (logged at most once a minute).
 */
async function maintenanceOf(req: MedusaRequest): Promise<MaintenanceSettings | null> {
  try {
    const values: unknown = await req.scope
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .getSection("maintenance")
    lastKnown = values as MaintenanceSettings
    return lastKnown
  } catch (error) {
    if (Date.now() - lastWarning >= WARN_EVERY_MS) {
      lastWarning = Date.now()
      logger.warn({
        event: "maintenance.guard_unreadable",
        fallback: lastKnown === null ? "open" : "last_read",
        err: errorSummary(error),
      })
    }
    return lastKnown
  }
}

function sectionState(req: MedusaRequest, section: MaintenanceSettings): Promise<SectionState> {
  const held = versions.get(section)
  if (held) {
    return held
  }
  const read = maintenanceState(req.scope)
  versions.set(section, read)
  read.catch(() => versions.delete(section))
  return read
}

/**
 * A bypass link's holder, through the storefront: the token is checked as
 * `GET /store/maintenance/bypass/:token` checks it (its signature, its
 * week, the section's version), so only a link the owner or an admin made
 * for the section as saved opens the shop. A malformed or ended token
 * costs no read.
 */
async function holdsBypass(req: MedusaRequest, section: MaintenanceSettings): Promise<boolean> {
  const sent = req.headers[MAINTENANCE_BYPASS_HEADER]
  const parts = typeof sent === "string" ? bypassParts(sent) : null
  if (!parts) {
    return false
  }
  try {
    const state = await sectionState(req, section)
    return state.enabled && bypassOpens(orderAccessKey(), parts, state.version)
  } catch {
    // An unreadable section opens no link
    return false
  }
}

/**
 * adr/0053 Ek 2026-11-17: while the shop is in maintenance, a Store API
 * write (and a shopper's registration) answers 503 `maintenance.shop_closed`
 * with `Retry-After`, as the storefront's page does, unless
 * `lib/storefront/maintenance-guard.ts` names it open or the caller holds
 * a bypass link. Reads never reach the setting. A setting that cannot be
 * read is taken as last read; never read at all, it blocks nothing
 * (fail-open, logged): maintenance is the shop's own pause, enforced first
 * at the storefront's edge, and the write needs the database that failed.
 */
export async function refuseWritesInMaintenance(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const body: unknown = req.body
  const decision = decideMaintenanceRequest(req.method, routePath(req), body)
  if (!decision.closed) {
    next()
    return
  }
  const maintenance = await maintenanceOf(req)
  if (!maintenance?.enabled || (await holdsBypass(req, maintenance))) {
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
