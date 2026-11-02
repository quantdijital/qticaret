import type { NextRequest } from "next/server"
import type { EdgeSite } from "../store-api/edge"
import { checkBypass } from "../store-api/edge"
import { maintenanceResponse } from "./page"
import { bypassCookieName, isBypassToken, isOpenDuringMaintenance } from "./rules"

/** What the proxy does with a request while the shop may be dark. */
export type MaintenanceGate =
  /** The 503 to answer with (pages, Server Actions and route handlers alike). */
  | { blocked: Response }
  /** Answer as usual; `bypassed` when only the visitor's bypass cookie let it through. */
  | { blocked: null; bypassed: boolean }

/**
 * The dark shop's gate (adr/0053): open paths and an open shop pass; a
 * visitor whose bypass cookie the backend still accepts passes too (asked
 * at most once a minute per token). Anyone else gets the 503 page; a
 * cookie that no longer opens, or never could, is cleared with it.
 */
export async function maintenanceGate(
  request: NextRequest,
  pathname: string,
  site: EdgeSite,
  context: { nonce: string; csp: string; production: boolean; visitorIp: string | null }
): Promise<MaintenanceGate> {
  const { maintenance } = site
  if (!maintenance.enabled || isOpenDuringMaintenance(pathname, maintenance.allowPaths)) {
    return { blocked: null, bypassed: false }
  }
  const name = bypassCookieName(context.production)
  const token = request.cookies.get(name)?.value
  const answer = isBypassToken(token) ? await checkBypass(token, context.visitorIp) : "closed"
  if (answer === "open") {
    return { blocked: null, bypassed: true }
  }
  const response = maintenanceResponse(
    { shopName: site.shopName, ...maintenance },
    { nonce: context.nonce, csp: context.csp, head: request.method === "HEAD" }
  )
  // The backend gave no answer: the cookie may still be good, it stays
  if (token !== undefined && answer === "closed") {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: context.production,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
  }
  return { blocked: response }
}
