import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, logger } from "../../../lib/logging"
import type { AuditEntryInput } from "../../../modules/audit-log/service"
import { routePathKeepingCase } from "../request-path"
import { auditContext, auditService, graphQuery } from "./context"
import { diffSnapshots } from "./diff"
import { describeRoute, matchAuditedResource } from "./registry"
import type { ResourceMatch, Snapshot } from "./registry"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const MAX_FIELDS = 100

// Names only: a body's values can be anything, personal data included
function bodyFields(body: unknown): string[] {
  return body !== null && typeof body === "object" && !Array.isArray(body)
    ? Object.keys(body).slice(0, MAX_FIELDS)
    : []
}

async function snapshotOf(req: MedusaRequest, match: ResourceMatch): Promise<Snapshot | null> {
  try {
    return await match.resource.snapshot(graphQuery(req), match.params)
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

async function writeEntry({ req, res, match, before, entry, fields }: PendingEntry) {
  let changes: Record<string, unknown> = { fields }
  // A refused request changed nothing; only a done one is read again
  if (match && before && res.statusCode < 400) {
    const after = await snapshotOf(req, match)
    if (after) {
      changes = { fields, diff: diffSnapshots(before, after, match.resource.sensitive) }
    }
  }
  try {
    await auditService(req).record({ ...entry, outcome: res.statusCode, changes })
  } catch (error) {
    logger.error({ event: "audit.write_failed", action: entry.action, err: errorSummary(error) })
  }
}

/**
 * `/admin/*` mutations (F2.5, adr/0011), recorded once the response has
 * finished: who, which route, which resource, the status. Registered
 * resources (prices) also get a field-by-field summary of what changed,
 * read before and after; any other route gets its body's field names. A
 * failed write is logged: the answer has already gone.
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
  const path = routePathKeepingCase(req)
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
  res.on("finish", () => {
    void writeEntry(pending)
  })
  next()
}
