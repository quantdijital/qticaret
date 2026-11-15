import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, logger } from "../../../lib/logging"
import type { AuditEntryInput } from "../../../modules/audit-log/service"
import { auditContext, auditService } from "./context"
import { diffSnapshots } from "./diff"
import { AUDIT_RESOURCE_ID, AUDIT_RESULT } from "./notes"
import { auditPath, describeRoute, matchAuditedResource } from "./registry"
import type { ResourceMatch } from "./registry"
import type { Snapshot } from "./types"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const MAX_FIELDS = 100
// Postgres jsonb refuses NUL and lone surrogates; a key like that would fail the write
const FIELD_NAME = /^[A-Za-z0-9_.-]{1,64}$/

// Names only: a body's values can be anything, personal data included
function bodyFields(body: unknown): string[] {
  return body !== null && typeof body === "object" && !Array.isArray(body)
    ? Object.keys(body)
        .slice(0, MAX_FIELDS)
        .map((key) => (FIELD_NAME.test(key) ? key : "<invalid>"))
    : []
}

async function snapshotOf(req: MedusaRequest, match: ResourceMatch): Promise<Snapshot | null> {
  try {
    return await match.resource.snapshot({ scope: req.scope, params: match.params, body: req.body })
  } catch (error) {
    logger.warn({
      event: "audit.snapshot_failed",
      action: match.resource.route,
      err: errorSummary(error),
    })
    return null
  }
}

interface PendingEntry {
  req: MedusaRequest
  res: MedusaResponse
  match: ResourceMatch | null
  before: Snapshot | null
  entry: Omit<AuditEntryInput, "outcome" | "changes">
  fields: string[]
}

/** What the handler added to its entry (`notes.ts`). */
function handlerNotes(res: MedusaResponse): { resourceId?: string; result?: unknown } {
  const locals = (res as { locals?: Record<string, unknown> }).locals ?? {}
  const resourceId = locals[AUDIT_RESOURCE_ID]
  const result = locals[AUDIT_RESULT]
  return {
    ...(typeof resourceId === "string" && resourceId !== "" ? { resourceId } : {}),
    ...(result !== undefined ? { result } : {}),
  }
}

async function writeEntry({ req, res, match, before, entry: sent, fields }: PendingEntry) {
  // A path no route answered names no kind of thing: anyone could make up
  // kinds by the hundred and push the real ones out of the viewer's filter
  const named = !match && res.statusCode === 404 ? { ...sent, resource_type: null } : sent
  const notes = handlerNotes(res)
  const entry =
    !named.resource_id && notes.resourceId ? { ...named, resource_id: notes.resourceId } : named
  let changes: Record<string, unknown> = {
    fields,
    ...(notes.result !== undefined ? { result: notes.result } : {}),
  }
  // Read again whatever the status: a failed request may still have changed something
  if (match && before) {
    const after = await snapshotOf(req, match)
    if (after) {
      changes = { ...changes, diff: diffSnapshots(before, after, match.resource.sensitive) }
    }
  }
  const service = auditService(req)
  try {
    await service.record({ ...entry, outcome: res.statusCode, changes })
  } catch (error) {
    logger.error({ event: "audit.write_failed", action: entry.action, err: errorSummary(error) })
    // Once more without the change summary, so the mutation leaves a trace
    try {
      await service.record({ ...entry, outcome: res.statusCode, changes: { write_failed: true } })
    } catch {
      // Logged above; the answer has already gone
    }
  }
}

/**
 * Calls `write` once, when the handler ends the response. Tied to `end`
 * rather than "finish": a client that hangs up after sending its request
 * gets no "finish", but the change is made and must be recorded.
 */
function onResponseEnd(res: MedusaResponse, write: () => void) {
  let done = false
  const once = () => {
    if (!done) {
      done = true
      setImmediate(write)
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
 * `/admin/*` mutations (F2.5, adr/0011), recorded once the handler has
 * answered: who, which route, which resource, the status. Registered
 * resources (prices) also get a field-by-field summary of what changed,
 * read before and after; any other route gets its body's field names. A
 * failed write is logged and retried without the summary.
 */
export async function auditMutations(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (SAFE_METHODS.has(req.method)) {
    next()
    return
  }
  const path = auditPath(req)
  const match = matchAuditedResource(req.method, path)
  const route = match
    ? {
        action: match.resource.route,
        resourceType: match.resource.resourceType,
        resourceId: match.resource.resourceId(match.params),
      }
    : describeRoute(req.method, path)
  const pending: PendingEntry = {
    req,
    res,
    match,
    before: match ? await snapshotOf(req, match) : null,
    entry: {
      kind: "mutation",
      action: route.action,
      resource_type: route.resourceType,
      resource_id: route.resourceId,
      ...auditContext(req),
    },
    fields: bodyFields(req.body),
  }
  onResponseEnd(res, () => {
    void writeEntry(pending)
  })
  next()
}
