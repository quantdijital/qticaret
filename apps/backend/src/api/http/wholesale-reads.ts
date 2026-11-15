import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { WHOLESALE_MODULE } from "../../modules/wholesale"
import type WholesaleModuleService from "../../modules/wholesale/service"
import { staffRoleOf } from "./staff-guard"

/**
 * Wholesale prices and members kept to the owner and admin (ADR-0068
 * decision 17) where Medusa's own admin routes would show them along
 * the way: a variant's price rows, a customer's groups.
 */

const ownedOf = (req: MedusaRequest) =>
  req.scope.resolve<WholesaleModuleService>(WHOLESALE_MODULE).ownedIds()

type Row = Record<string, unknown>
const MAX_DEPTH = 8

/** Every array a key of this name holds, anywhere in the answer. */
function arraysUnder(body: unknown, key: string, found: unknown[][] = [], depth = 0): unknown[][] {
  if (depth > MAX_DEPTH || typeof body !== "object" || body === null) {
    return found
  }
  for (const [name, value] of Object.entries(body as Row)) {
    if (name === key && Array.isArray(value)) {
      found.push(value)
    }
    if (typeof value === "object" && value !== null) {
      arraysUnder(value, key, found, depth + 1)
    }
  }
  return found
}

const idOf = (row: unknown): string | null => {
  const id = (row as { id?: unknown } | null)?.id
  return typeof id === "string" ? id : null
}

/** Removes in place the rows of these arrays whose id is dropped. */
function dropRows(arrays: unknown[][], dropped: ReadonlySet<string>): void {
  for (const rows of arrays) {
    const kept = rows.filter((row) => !dropped.has(idOf(row) ?? ""))
    rows.splice(0, rows.length, ...kept)
  }
}

/**
 * A product's or variant's price rows (`variants.prices`,
 * `variants.price_set.prices`, however expanded) leave out those on a
 * wholesale list, for everyone: the rows are found by their id, so the
 * answer need not have asked for `price_list_id`. A failed check drops
 * every price row rather than show one it could not check.
 */
export function hideWholesalePriceRows(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const send = res.json.bind(res)
  res.json = (body: unknown) => {
    const arrays = arraysUnder(body, "prices")
    const ids = [...new Set(arrays.flat().flatMap((row) => idOf(row) ?? []))]
    if (ids.length === 0) {
      return send(body)
    }
    void (async () => {
      const owned = await ownedOf(req)
      if (owned.priceListIds.size === 0) {
        return new Set<string>()
      }
      const rows = await req.scope
        .resolve(Modules.PRICING)
        .listPrices(
          { id: ids, price_list_id: [...owned.priceListIds] },
          { select: ["id"], take: null }
        )
      return new Set(rows.map((row) => row.id))
    })()
      .then(
        (dropped) => {
          dropRows(arrays, dropped)
        },
        (error: unknown) => {
          logger.warn({ event: "wholesale.price_rows_unfiltered", err: errorSummary(error) })
          dropRows(arrays, new Set(ids))
        }
      )
      .finally(() => send(body))
    return res
  }
  next()
}

const MANAGERS = new Set(["owner", "admin"])
const isManager = async (req: MedusaRequest) => MANAGERS.has((await staffRoleOf(req)) ?? "")

/**
 * Who is in a wholesale group is the owner's and admin's (decision 17):
 * for anyone else (another role, an API key) a customer list asked by a
 * wholesale group is refused, and a customer's groups leave the
 * wholesale ones out.
 */
export async function guardWholesaleMembers(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    if (await isManager(req)) {
      next()
      return
    }
    const owned = await ownedOf(req)
    if (owned.groupIds.size === 0) {
      next()
      return
    }
    const asked = JSON.stringify(req.query["groups"] ?? null)
    if ([...owned.groupIds].some((id) => asked.includes(id))) {
      next(new ValidationError("wholesale.managed", { field: "groups" }))
      return
    }
    const send = res.json.bind(res)
    res.json = (body: unknown) => {
      for (const groups of arraysUnder(body, "groups")) {
        // A group read without its id cannot be told apart: left out too
        const kept = groups.filter((group) => {
          const id = idOf(group)
          return id !== null && !owned.groupIds.has(id)
        })
        groups.splice(0, groups.length, ...kept)
      }
      return send(body)
    }
    next()
  } catch (error) {
    next(error)
  }
}
