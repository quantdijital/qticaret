import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { parseKey } from "../../lib/crypto/pii"
import { parseEnv } from "../../lib/env"
import { blockEntryOf, matchesOf } from "../../lib/fraud/block"
import { CHECKOUT_VELOCITY, countCheckout } from "../../lib/fraud/velocity"
import { errorSummary, logger } from "../../lib/logging"
import { perIpScale } from "../../lib/security/rate-limit"
import { FRAUD_GUARD_MODULE } from "../../modules/fraud-guard"
import type FraudGuardModuleService from "../../modules/fraud-guard/service"
import { noteCheckoutWorkflow } from "../../workflows/fraud/note-checkout"
import { challengePassed, demandChallenge } from "./challenge"
import { clientBucket, sharedRateLimitStore } from "./rate-limit"
import { rejectRequest } from "./reject"

interface CartRow {
  email?: string | null
  shipping_address?: { phone?: string | null } | null
  billing_address?: { phone?: string | null } | null
}

let key: Buffer | undefined
const keyOf = () => (key ??= parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY"))

async function cartOf(req: MedusaRequest): Promise<CartRow | undefined> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["email", "shipping_address.phone", "billing_address.phone"],
    filters: { id: req.params["id"] ?? "" },
  })
  return data[0]
}

const phonesOf = (cart: CartRow) => [cart.shipping_address?.phone, cart.billing_address?.phone]

/** 403 with a sentence that does not say why, when the cart's buyer is on the block list. */
async function refusedAsBlocked(
  req: MedusaRequest,
  res: MedusaResponse,
  cart: CartRow
): Promise<boolean> {
  const ip = req.ip ?? req.socket.remoteAddress ?? null
  const blocked = await req.scope
    .resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE)
    .blockedBy(matchesOf({ email: cart.email, phones: phonesOf(cart), ip }, keyOf()))
  if (!blocked) {
    return false
  }
  logger.warn({ event: "fraud.checkout_blocked", kind: blocked.kind })
  rejectRequest(
    req,
    res,
    403,
    { type: "not_allowed", message: "fraud.checkout_refused" },
    "checkout_blocked"
  )
  return true
}

/**
 * The checkout's fraud guard where paying begins (F15.6, adr/0044 §2, §4):
 * `POST /store/carts/:id/payment-session`, which every way to pay passes,
 * a hosted card form included (its order is placed by the provider's
 * notice, never through `/complete`).
 * - the block list stops it (403);
 * - each start is counted: past the soft velocity limits the visitor
 *   proves themselves (428 and a challenge), past the hard ones 429;
 * - what it counted is left on the cart for the order's score.
 * Counting or noting failing lets it through, logged: the provider's own
 * checks remain, and the order is checked against the list once more.
 */
export async function guardPaymentStart(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.method !== "POST") {
    next()
    return
  }
  try {
    const cart = await cartOf(req)
    if (!cart) {
      // The route answers an unknown cart itself
      next()
      return
    }
    if (await refusedAsBlocked(req, res, cart)) {
      return
    }
    const phone = phonesOf(cart).find(Boolean) ?? null
    const scale = perIpScale()
    const counts = await countCheckout(
      sharedRateLimitStore(),
      {
        ipBucket: clientBucket(req),
        emailKey: cart.email ? (blockEntryOf("email", cart.email, keyOf())?.match ?? null) : null,
        phoneKey: phone ? (blockEntryOf("phone", phone, keyOf())?.match ?? null) : null,
      },
      CHECKOUT_VELOCITY,
      scale
    )
    if (counts.verdict === "block") {
      logger.warn({ event: "fraud.checkout_velocity" })
      rejectRequest(
        req,
        res,
        429,
        { type: "not_allowed", message: "fraud.velocity" },
        "checkout_velocity"
      )
      return
    }
    if (counts.verdict === "challenge" && !(await challengePassed(req, "checkout"))) {
      demandChallenge(req, res, "checkout")
      return
    }
    await noteCheckoutWorkflow(req.scope).run({
      input: {
        cart_id: req.params["id"] ?? "",
        // An address's count at its real size, as the limits were grown
        signals: {
          ip_emails: Math.floor(counts.ipEmails / scale),
          phone_emails: counts.phoneEmails,
        },
      },
    })
  } catch (error) {
    logger.error({ event: "fraud.checkout_guard_failed", err: errorSummary(error) })
  }
  next()
}

/**
 * `POST /store/carts/:id/complete` (cash on delivery, bank transfer): the
 * block list once more, with the visitor's address. Not counted again:
 * starting the payment was. A list out of reach lets it through, logged;
 * the order's own check (`completeCartWorkflow` hook) still runs.
 */
export async function guardCheckout(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.method !== "POST") {
    next()
    return
  }
  try {
    const cart = await cartOf(req)
    if (cart && (await refusedAsBlocked(req, res, cart))) {
      return
    }
  } catch (error) {
    logger.error({ event: "fraud.checkout_guard_failed", err: errorSummary(error) })
  }
  next()
}
