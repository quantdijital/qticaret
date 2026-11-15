import type { NextRequest } from "next/server"
import type { EdgeSite } from "../store-api/edge"
import { checkBypass } from "../store-api/edge"
import { maintenanceResponse, suspendedNotice } from "./page"
import {
  bypassCookieName,
  isBypassToken,
  isOpenDuringMaintenance,
  isOpenWhileSuspended,
} from "./rules"

/** What the proxy does with a request while the shop may be dark. */
export type MaintenanceGate =
  /** The 503 to answer with (pages, Server Actions and route handlers alike). */
  | { blocked: Response }
  /** Answer as usual; `bypassed` when only the visitor's bypass cookie let it through. */
  | { blocked: null; bypassed: boolean }

/**
 * The dark shop's gate (adr/0053): an open shop passes, so do its open
 * paths for GET and HEAD and a card provider's return for its POST too
 * (adr/0053 Ek 2026-11-15: no Server Action by an open path's name); a
 * visitor whose bypass cookie the backend still accepts passes too (asked
 * at most once a minute per token). Anyone else gets the 503 page; a
 * cookie that no longer opens, or never could, is cleared with it. A
 * shop the platform suspended (adr/0061 Ek C15) gets the same 503 with the
 * platform's words, open only for robots.txt, the sitemaps and a card
 * provider's return; the shop's open paths and bypass cookie do nothing.
 */
export async function maintenanceGate(
  request: NextRequest,
  pathname: string,
  site: EdgeSite,
  context: {
    nonce: string
    csp: string
    production: boolean
    visitorIp: string | null
  }
): Promise<MaintenanceGate> {
  // The platform's suspension (adr/0061 Ek C15) before the shop's own maintenance: no
  // open path of the shop's and no bypass cookie opens it
  if (site.suspended) {
    return isOpenWhileSuspended(pathname, request.method)
      ? { blocked: null, bypassed: false }
      : {
          blocked: maintenanceResponse(suspendedNotice(site.shopName), {
            nonce: context.nonce,
            csp: context.csp,
            head: request.method === "HEAD",
          }),
        }
  }
  const { maintenance } = site
  if (
    !maintenance.enabled ||
    isOpenDuringMaintenance(pathname, request.method, maintenance.allowPaths)
  ) {
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
