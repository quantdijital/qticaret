import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { giftCardCode, isGiftCardPrefix, normalizeCode } from "../../lib/promotions"
import { routePath } from "../http/request-path"

/**
 * Gift card codes on their way in (F4.8, ADR-0025). The loyalty plugin
 * finds a card by its code byte for byte, so codes are kept and read in
 * one form (`normalizeCode`, as promotion codes are). Every card made gets
 * a code of sixteen random characters (`giftCardCode`); a code the shop
 * types is its prefix. Registered without `methods`, so the plugin
 * validates the body this leaves.
 */

type Body = Record<string, unknown>

const isBody = (value: unknown): value is Body =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const CREATE = "/admin/gift-cards"
// A shopper adds a card to a cart or takes it off by its code
const CART_CODE = /^\/store\/carts\/[^/]+\/gift-cards$/u

function codeOfNewCard(sent: unknown): unknown {
  if (sent === undefined || sent === null || (typeof sent === "string" && !sent.trim())) {
    return giftCardCode()
  }
  if (typeof sent !== "string") {
    // Left for the plugin's validator to refuse
    return sent
  }
  const prefix = normalizeCode(sent).replace(/-+$/u, "")
  if (!isGiftCardPrefix(prefix)) {
    throw new ValidationError("gift_cards.code_prefix", { field: "code" })
  }
  return giftCardCode(prefix)
}

function readCodes(req: MedusaRequest): void {
  const body: unknown = req.body
  if (!isBody(body)) {
    return
  }
  const path = routePath(req)
  if (req.method === "POST" && path === CREATE) {
    body["code"] = codeOfNewCard(body["code"])
    return
  }
  const code = body["code"]
  if ((req.method === "POST" || req.method === "DELETE") && CART_CODE.test(path)) {
    if (typeof code === "string") {
      body["code"] = normalizeCode(code)
    }
  }
}

export function giftCardCodes(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    readCodes(req)
  } catch (error) {
    next(error)
    return
  }
  next()
}
