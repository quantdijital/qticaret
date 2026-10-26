import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import {
  CODE_PATTERN,
  enteredCodes,
  MAX_CODES_PER_REQUEST,
  normalizeCode,
} from "../../lib/promotions"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { PromotionSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { decodedSegment, routePath, routePathKeepingCase } from "../http/request-path"

type Body = Record<string, unknown> | undefined

/**
 * Which cart route a request is: its codes become those sent (creating or
 * updating a cart), are added to (`POST .../promotions`) or are removed
 * (`DELETE .../promotions`). Read from the path: these middlewares run
 * before Medusa validates the body (no `methods`, so `app.use`), where
 * route params are not filled.
 */
export interface CartRoute {
  mode: "replace" | "add" | "remove"
  cartId: string | null
}

export function cartRoute(req: MedusaRequest): CartRoute | null {
  const parts = routePathKeepingCase(req).split("/").filter(Boolean)
  if (parts[0]?.toLowerCase() !== "store" || parts[1]?.toLowerCase() !== "carts") {
    return null
  }
  // As the route reads it: `cart%5F01` is the same cart, counted as one
  const cartId = parts[2] === undefined ? null : decodedSegment(parts[2])
  if (parts.length <= 3) {
    return req.method === "POST" ? { mode: "replace", cartId } : null
  }
  if (parts.length === 4 && parts[3]?.toLowerCase() === "promotions") {
    if (req.method === "POST") {
      return { mode: "add", cartId }
    }
    return req.method === "DELETE" ? { mode: "remove", cartId } : null
  }
  return null
}

/** The codes a Store request sends (`promo_codes`), read as the shop keeps them; none when it sends none. */
export function sentCodes(req: MedusaRequest): string[] | null {
  const codes = (req.body as Body)?.["promo_codes"]
  if (!Array.isArray(codes)) {
    return null
  }
  return [...new Set(codes.filter((code) => typeof code === "string").map(normalizeCode))]
}

// `/admin/promotions` and `/admin/promotions/:id`: where a promotion's code is saved
const PROMOTION_PATH = /^\/admin\/promotions(\/[^/]+)?$/

/** A promotion saved by the admin keeps its code in the shop's form (ADR-0024). */
export function normalizePromotionCode(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const body = req.body as Body
  if (
    req.method === "POST" &&
    PROMOTION_PATH.test(routePath(req)) &&
    body &&
    typeof body["code"] === "string"
  ) {
    const code = normalizeCode(body["code"])
    // Also what keeps a code harmless in the batch CSVs it may prefix
    if (!CODE_PATTERN.test(code)) {
      next(new ValidationError("promotions.code_invalid", { field: "code" }))
      return
    }
    body["code"] = code
  }
  next()
}

/** A code a shopper sends finds the promotion however it was typed (ADR-0024). */
export function normalizePromoCodes(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const body = req.body as Body
  const codes = cartRoute(req) ? sentCodes(req) : null
  if (codes && codes.length > MAX_CODES_PER_REQUEST) {
    next(new ValidationError("promotions.too_many_codes", { field: "promo_codes" }))
    return
  }
  if (body && codes) {
    body["promo_codes"] = codes
  }
  next()
}

async function codesOnCart(req: MedusaRequest, cartId: string): Promise<string[]> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["promotions.code", "promotions.is_automatic"],
    filters: { id: cartId },
  })
  const cart = data[0] as
    | { promotions?: ({ code?: string | null; is_automatic?: boolean | null } | null)[] | null }
    | undefined
  return enteredCodes(cart?.promotions)
}

/**
 * One code per cart unless the shop combines them (ADR-0024); automatic
 * promotions apply beside it either way. Creating or updating a cart sets
 * its codes to those sent; adding counts those it has too.
 */
export async function oneCodePerCart(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const route = cartRoute(req)
    const codes = sentCodes(req)
    if (!route || route.mode === "remove" || !codes || codes.length === 0) {
      next()
      return
    }
    const settings = (await req.scope
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .getSection("promotions")) as unknown as PromotionSettings
    if (settings.combine_codes) {
      next()
      return
    }
    const others =
      route.mode === "add" && route.cartId
        ? (await codesOnCart(req, route.cartId)).filter((code) => !codes.includes(code))
        : []
    if (codes.length + others.length > 1) {
      throw new ValidationError("promotions.one_code", { field: "promo_codes" })
    }
    next()
  } catch (error) {
    next(error)
  }
}
