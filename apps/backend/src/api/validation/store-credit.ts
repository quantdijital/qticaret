import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { answerAsMissing } from "../http/require-feature"
import { rejectRequest } from "../http/reject"
import { decodedSegment, routePath, routePathKeepingCase } from "../http/request-path"

/**
 * Store credit is a customer's own money at the shop (F4.8, ADR-0025).
 * The loyalty plugin opens an account for any customer, a guest's too, and
 * spends the account of a cart's customer for whoever is signed in. A
 * guest cannot sign in, and anyone who starts a cart with a guest's e-mail
 * could spend theirs. So accounts are for customers with an account, and
 * only the cart's own customer spends credit on it. Claiming an account by
 * its code waits for the storefront (F18): nothing hands shoppers those
 * codes, which the plugin draws weakly.
 */

const ACCOUNTS = "/admin/store-credit-accounts"
const CLAIM = "/store/store-credit-accounts/claim"
const CART_CREDITS = /^\/store\/carts\/(?<cart>[^/]+)\/store-credits$/iu

const signedInCustomer = authenticate("customer", ["session", "bearer"])

async function hasAccount(req: MedusaRequest, customerId: string): Promise<boolean | null> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["has_account"],
    filters: { id: customerId },
  })
  const row = data[0] as { has_account?: boolean | null } | undefined
  return row ? row.has_account === true : null
}

async function cartCustomer(req: MedusaRequest, cartId: string): Promise<string | null> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["customer_id"],
    filters: { id: cartId },
  })
  return (data[0] as { customer_id?: string | null } | undefined)?.customer_id ?? null
}

// An account for a guest is refused; an unknown customer is left to the plugin
async function membersOnly(req: MedusaRequest): Promise<void> {
  const customerId = (req.body as { customer_id?: unknown } | undefined)?.customer_id
  if (typeof customerId === "string" && (await hasAccount(req, customerId)) === false) {
    throw new ValidationError("gift_cards.guest_account", { field: "customer_id" })
  }
}

async function ownCartOnly(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const cartId = decodedSegment(
    CART_CREDITS.exec(routePathKeepingCase(req))?.groups?.["cart"] ?? ""
  )
  const actor = (req as AuthenticatedMedusaRequest).auth_context.actor_id
  if ((await cartCustomer(req, cartId)) !== actor) {
    // As for a cart that does not exist: whose cart it is stays unsaid
    rejectRequest(req, res, 404, { type: "not_found", message: "Cart not found" }, "cart_not_owned")
    return
  }
  next()
}

export async function storeCreditGuards(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const path = routePath(req)
  try {
    if (path === CLAIM) {
      answerAsMissing(req, res, "store_credit_claim_closed")
      return
    }
    if (req.method === "POST" && path === ACCOUNTS) {
      await membersOnly(req)
    } else if (req.method === "POST" && CART_CREDITS.test(path)) {
      signedInCustomer(req, res, (error?: unknown) => {
        if (error) {
          next(error)
          return
        }
        ownCartOnly(req, res, next).catch(next)
      })
      return
    }
  } catch (error) {
    next(error)
    return
  }
  next()
}
