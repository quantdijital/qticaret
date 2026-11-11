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

const present = (value: string | undefined | null): string | null =>
  value === undefined || value === null || value === "" ? null : value

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

interface Auditable {
  /** What a handler changed, as `{ from, to }` summaries; never a secret (L6). */
  cpAuditChanges?: Record<string, unknown>
  /** Who the request turned out to be, when no actor is signed in (a sign-in). */
  cpAuditActor?: { type: string; id: string }
  /** What a route without an id parameter made (a new shop): its id. */
  cpAuditResourceId?: string
}

/** A handler's own summary of what it changed, merged into its audit row. */
export function noteAuditChanges(req: MedusaRequest, changes: Record<string, unknown>): void {
  const auditable = req as unknown as Auditable
  auditable.cpAuditChanges = { ...auditable.cpAuditChanges, ...changes }
}

/** The record a route made, for a route whose path names none (`POST /admin/cp/tenants`). */
export function noteAuditResource(req: MedusaRequest, id: string): void {
  ;(req as unknown as Auditable).cpAuditResourceId = id
}

/** The person a request without a signed-in actor turned out to be (a sign-in's login). */
export function noteAuditActor(req: MedusaRequest, actor: { type: string; id: string }): void {
  ;(req as unknown as Auditable).cpAuditActor = actor
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
  const { cpAuditChanges, cpAuditActor, cpAuditResourceId } = req as unknown as Auditable
  const row: CpAuditInput = {
    ...entry,
    resource_id: entry.resource_id ?? cpAuditResourceId ?? null,
    actor_type: present(auth?.actor_type) ?? cpAuditActor?.type ?? null,
    // Empty while an invitation is accepted: the user does not exist yet
    actor_id: present(auth?.actor_id) ?? cpAuditActor?.id ?? null,
    outcome: res.statusCode,
    changes: entry.changes || cpAuditChanges ? { ...entry.changes, ...cpAuditChanges } : null,
  }
  try {
    await req.scope.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record(row)
  } catch (error) {
    loggerOf(req)?.error(
      `cp.audit_write_failed ${JSON.stringify({ action: row.action, err: errorSummary(error) })}`
    )
  }
}

/**
 * Writes `entry` once the handler has answered. Tied to `end` rather than
 * "finish": a client that hangs up still made its change.
 */
function writeWhenAnswered(
  req: MedusaRequest,
  res: MedusaResponse,
  entry: CpAuditInput,
  refusalsOnly = false
) {
  let done = false
  const once = () => {
    if (!done) {
      done = true
      if (!refusalsOnly || res.statusCode >= 400) {
        setImmediate(() => void write(req, res, entry))
      }
    }
  }
  const end = res.end.bind(res) as (...args: unknown[]) => MedusaResponse
  res.end = ((...args: unknown[]) => {
    once()
    return end(...args)
  }) as MedusaResponse["end"]
  res.on("finish", once)
}

/**
 * Every `/admin/cp/*` mutation, and the reads the route table marks, is
 * recorded once answered, refused ones included (adr/0061 §3.5): who,
 * which route, what it acted on, the status, the request ID, the address's
 * keyed hash, the body's field names (never their values) and the
 * handler's own `{ from, to }`. Runs before the staff guard, so a refusal
 * leaves its row.
 */
export function auditCpRequests(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const read = SAFE_METHODS.has(req.method)
  const rule = routeOf(req)?.rule
  if (read && !rule?.auditRead) {
    next()
    return
  }
  // A read written before it is shown (a TCKN, Ek C4 L6) leaves only its refusals here
  writeWhenAnswered(
    req,
    res,
    {
      kind: read ? "sensitive_read" : "mutation",
      ...describe(req),
      request_id: req.requestId ?? null,
      ip_hash: ipHashOf(req),
      changes: read ? null : { fields: bodyFields(req.body) },
    },
    rule?.auditBefore === true
  )
  next()
}

/**
 * A sensitive read recorded before it is shown (adr/0061 §3.5; Ek C4: "write
 * first; unwritten, not shown"): the row as `auditCpRequests` would write
 * it, kind `sensitive_read`, awaited. False when it could not be written:
 * the caller answers without the data.
 */
export async function recordReadFirst(req: MedusaRequest): Promise<boolean> {
  const auth = authOf(req)
  const { action, resource_type, resource_id } = describe(req)
  try {
    await req.scope.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
      kind: "sensitive_read",
      action,
      actor_type: present(auth?.actor_type),
      actor_id: present(auth?.actor_id),
      resource_type,
      resource_id,
      outcome: 200,
      changes: null,
      request_id: req.requestId ?? null,
      ip_hash: ipHashOf(req),
    })
    return true
  } catch (error) {
    loggerOf(req)?.error(
      `cp.audit_write_failed ${JSON.stringify({ action, err: errorSummary(error) })}`
    )
    return false
  }
}

/**
 * A staff sign-in event (L6): sign-in, its 2FA step, a session opened or
 * ended, a login registered. The address only as a keyed hash; the body's
 * values never.
 */
export function auditAuth(action: string) {
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const email = (req.body as { email?: unknown } | undefined)?.email
    writeWhenAnswered(req, res, {
      kind: "mutation",
      action,
      resource_type: "cp_login",
      resource_id:
        typeof email === "string" ? keyed("cp_audit_email", email.trim().toLowerCase(), 24) : null,
      request_id: req.requestId ?? null,
      ip_hash: ipHashOf(req),
      changes: null,
    })
    next()
  }
}
