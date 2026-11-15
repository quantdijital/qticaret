import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ConflictError } from "../../lib/errors"
import { touchesOwned } from "../../lib/wholesale"
import type { GuardCheck } from "../../lib/wholesale"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import type WholesaleModuleService from "../../modules/wholesale/service"

const ownedOf = (req: MedusaRequest) =>
  req.scope.resolve<WholesaleModuleService>(WHOLESALE_MODULE).ownedIds()

/**
 * Refuses a write through Medusa's own routes to a customer group or
 * price list the wholesale module owns (ADR-0068 §9): `wholesale.managed`,
 * 409. The wholesale screens are the one way to them, recorded there.
 * Reads pass. Runs whether the flag is on or off: the records stay.
 */
export function guardWholesaleRecords(check: GuardCheck) {
  return async (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        next()
        return
      }
      const owned = await ownedOf(req)
      const request = { method: req.method, id: req.params["id"], body: req.body }
      next(touchesOwned(check, request, owned) ? new ConflictError("wholesale.managed") : undefined)
    } catch (error) {
      next(error)
    }
  }
}

type Listing = "price_lists" | "customer_groups"

/** The answer without the module's rows; the count loses what it drops. */
export function withoutOwned(body: unknown, key: Listing, ids: ReadonlySet<string>): unknown {
  const answer = body as Record<string, unknown> | null
  const rows = answer?.[key]
  if (!answer || !Array.isArray(rows)) {
    return body
  }
  const idOf = (row: unknown) => {
    const id = (row as { id?: unknown } | null)?.id
    return typeof id === "string" ? id : ""
  }
  const kept = rows.filter((row) => !ids.has(idOf(row)))
  const count = typeof answer["count"] === "number" ? answer["count"] : null
  return {
    ...answer,
    [key]: kept,
    ...(count === null ? {} : { count: Math.max(0, count - (rows.length - kept.length)) }),
  }
}

/**
 * Medusa's own lists of price lists and customer groups leave the
 * wholesale ones out (ADR-0068 §9): they are edited on the wholesale
 * screens only. Left out of the query when nothing else names ids, and
 * out of the answer in any case.
 */
export function hideWholesaleRecords(key: Listing) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      const owned = await ownedOf(req)
      const ids = key === "price_lists" ? owned.priceListIds : owned.groupIds
      if (ids.size === 0) {
        next()
        return
      }
      const filters = req.filterableFields as Record<string, unknown> | undefined
      if (filters && filters["id"] === undefined) {
        filters["id"] = { $nin: [...ids] }
      }
      const send = res.json.bind(res)
      res.json = (body: unknown) => send(withoutOwned(body, key, ids))
      next()
    } catch (error) {
      next(error)
    }
  }
}
