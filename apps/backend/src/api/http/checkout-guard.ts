import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { parseKey } from "../../lib/crypto/pii"
import { parseEnv } from "../../lib/env"
import { blockEntryOf, matchesOf } from "../../lib/fraud/block"
import { CHECKOUT_VELOCITY, countCheckout } from "../../lib/fraud/velocity"
import { perIpScale } from "../../lib/security/rate-limit"
import { errorSummary, logger } from "../../lib/logging"
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

/**
 * The checkout's fraud guard (F15.6, adr/0044 §2, §4), before Medusa
 * completes the cart:
 * - an e-mail, domain, phone or address on the shop's block list stops it
 *   (403, a sentence that does not say why);
 * - past the hard velocity limit it stops (429), past the soft one the
 *   visitor proves themselves first (428 and a challenge);
 * - what it counted is left on the cart for the order's score.
 * Counting or noting failing lets the checkout through, logged; a block
 * list that cannot be read too: the payment provider's own checks remain.
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
  const cartId = req.params["id"] ?? ""
  try {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: ["email", "shipping_address.phone", "billing_address.phone"],
      filters: { id: cartId },
    })
    const cart = data[0] as CartRow | undefined
    if (!cart) {
      // Medusa answers an unknown cart itself
      next()
      return
    }
    const phone = cart.shipping_address?.phone ?? cart.billing_address?.phone ?? null
    const ip = req.ip ?? req.socket.remoteAddress ?? null
    const blocked = await req.scope
      .resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE)
      .blockedBy(matchesOf({ email: cart.email, phone, ip }, keyOf()))
    if (blocked) {
      logger.warn({ event: "fraud.checkout_blocked", kind: blocked.kind })
      rejectRequest(
        req,
        res,
        403,
        { type: "not_allowed", message: "fraud.checkout_refused" },
        "checkout_blocked"
      )
      return
    }
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
        cart_id: cartId,
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
