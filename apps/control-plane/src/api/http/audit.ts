import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { decodedSegment, errorSummary } from "@qticaret/server-kit"
import { CP_AUDIT_MODULE } from "../../modules/cp-audit"
import type CpAuditModuleService from "../../modules/cp-audit/service"
import type { CpAuditInput } from "../../modules/cp-audit/service"
import { authOf, keyed } from "./caller"
import { loggerOf, requestTarget } from "./request"
import { routeOf } from "./staff-guard"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const MAX_FIELDS = 50
// Postgres jsonb refuses NUL and lone surrogates; a key like that would fail the write
const FIELD_NAME = /^[A-Za-z0-9_.-]{1,64}$/

const present = (value: string | undefined): string | null =>
  value === undefined || value === "" ? null : value

// Names only: a body's values can be anything, a password or a code included
function bodyFields(body: unknown): string[] {
  return body !== null && typeof body === "object" && !Array.isArray(body)
    ? Object.keys(body)
        .slice(0, MAX_FIELDS)
        .map((key) => (FIELD_NAME.test(key) ? key : "<invalid>"))
    : []
}

/** The client's address as a keyed hash: the same place twice is visible, the place is not. */
function ipHashOf(req: MedusaRequest): string | null {
  const ip = req.ip ?? req.socket.remoteAddress
  return ip ? keyed("cp_audit_ip", ip) : null
}

/** The row's action: the table's pattern, else the method and a short, query-less path. */
function describe(req: MedusaRequest) {
  const match = routeOf(req)
  if (!match) {
    const path = requestTarget(req).split(/[?#]/)[0]?.slice(0, 200) ?? ""
    return { action: `${req.method} ${path}`, resource_type: null, resource_id: null }
  }
  const { rule, params } = match
  const raw = rule.resource?.param ? params[rule.resource.param] : undefined
  return {
    action: `${rule.method} ${rule.path}`,
    resource_type: rule.resource?.type ?? null,
    resource_id: raw === undefined ? null : decodedSegment(raw).slice(0, 200),
  }
}

async function write(req: MedusaRequest, res: MedusaResponse, entry: CpAuditInput) {
  // Read once answered: an invitation's acceptance signs its login in on the way
  const auth = authOf(req)
  const row: CpAuditInput = {
    ...entry,
    actor_type: present(auth?.actor_type),
    // Empty while an invitation is accepted: the user does not exist yet
    actor_id: present(auth?.actor_id),
    outcome: res.statusCode,
  }
  const service = req.scope.resolve<CpAuditModuleService>(CP_AUDIT_MODULE)
  try {
    await service.record(row)
  } catch (error) {
    loggerOf(req)?.error(
      `cp.audit_write_failed ${JSON.stringify({ action: row.action, err: errorSummary(error) })}`
    )
  }
}

/**
 * Every `/admin/cp/*` mutation, and the reads the route table marks, is
 * recorded once answered, refused ones included (adr/0061 §3.5): who,
 * which route, what it acted on, the status, the request ID, the address's
 * keyed hash, and the body's field names, never their values. Runs before
 * the staff guard, so a refusal leaves its row. Tied to `end` rather than
 * "finish": a client that hangs up still made its change.
 */
export function auditCpRequests(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const read = SAFE_METHODS.has(req.method)
  if (read && !routeOf(req)?.rule.auditRead) {
    next()
    return
  }
  const entry: CpAuditInput = {
    kind: read ? "sensitive_read" : "mutation",
    ...describe(req),
    request_id: req.requestId ?? null,
    ip_hash: ipHashOf(req),
    changes: read ? null : { fields: bodyFields(req.body) },
  }
  let done = false
  const once = () => {
    if (!done) {
      done = true
      setImmediate(() => void write(req, res, entry))
    }
  }
  const end = res.end.bind(res) as (...args: unknown[]) => MedusaResponse
  res.end = ((...args: unknown[]) => {
    once()
    return end(...args)
  }) as MedusaResponse["end"]
  res.on("finish", once)
  next()
}
