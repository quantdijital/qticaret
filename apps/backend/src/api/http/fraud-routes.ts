import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { parseKey } from "../../lib/crypto/pii"
import { parseEnv } from "../../lib/env"
import { ValidationError } from "../../lib/errors"
import { matchesOf } from "../../lib/fraud/block"
import { errorSummary, logger } from "../../lib/logging"
import { FRAUD_GUARD_MODULE } from "../../modules/fraud-guard"
import type FraudGuardModuleService from "../../modules/fraud-guard/service"
import {
  AdminGetFraudBlocks,
  AdminGetFraudReviews,
  AdminPostFraudBlock,
  AdminPostFraudDecision,
} from "../admin/fraud/validators"
import { challengeAfterAttempts, challengeOver } from "./challenge"
import { rejectRequest } from "./reject"
import { clientIp } from "./client-ip"

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

/**
 * Medusa's own fulfillment routes ship too: a held order is refused there
 * as in "Kargoya ver" (the order in the path, or named in the body).
 */
async function refuseHeldOrder(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const named = (req.body as { order_id?: unknown } | undefined)?.order_id
  const orderId = req.params["id"] ?? (typeof named === "string" ? named : "")
  if (req.method !== "POST" || !orderId) {
    next()
    return
  }
  try {
    const held = await req.scope
      .resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE)
      .heldStatus(orderId)
    next(held ? new ValidationError(`fraud.review_${held}`) : undefined)
  } catch (error) {
    next(error)
  }
}

let key: Buffer | undefined
const keyOf = () => (key ??= parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY"))

/**
 * A registration, a sign-in or an account from an e-mail, a domain or an
 * address on the shop's block list (adr/0044 §4) stops. A sign-in answers
 * as a wrong password does, so the list tells no one who is on it; the
 * others with a sentence that does not say why. The list out of reach lets
 * the request through, logged.
 */
function refuseBlocked(answer: "refused" | "sign_in") {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const email = (req.body as { email?: unknown } | undefined)?.email
    if (req.method !== "POST") {
      next()
      return
    }
    try {
      const blocked = await req.scope
        .resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE)
        .blockedBy(
          matchesOf(
            {
              email: typeof email === "string" ? email : null,
              ip: clientIp(req),
            },
            keyOf()
          )
        )
      if (blocked) {
        logger.warn({ event: "fraud.account_blocked", kind: blocked.kind })
        if (answer === "sign_in") {
          // Medusa's own answer to a wrong password (emailpass, 2.21.2)
          next(new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid email or password"))
          return
        }
        rejectRequest(
          req,
          res,
          403,
          { type: "not_allowed", message: "fraud.refused" },
          "account_blocked"
        )
        return
      }
    } catch (error) {
      logger.error({ event: "fraud.block_check_failed", err: errorSummary(error) })
    }
    next()
  }
}

/**
 * F15.6 (adr/0044): proofs of work past each scope's soft limit, the held
 * orders' queue and the block list. The checkout's guard sits in the
 * payment chain (payment-routes).
 */
export const FRAUD_ROUTES = [
  {
    matcher: "/auth/customer/emailpass/register",
    middlewares: [refuseBlocked("refused"), challengeOver("register", { max: 3, windowMs: HOUR })],
  },
  // `methods`: a matcher without them takes every path below it, registration included
  {
    matcher: "/auth/customer/emailpass",
    methods: ["POST" as const],
    middlewares: [
      refuseBlocked("sign_in"),
      challengeAfterAttempts({ max: 5, windowMs: 15 * MINUTE }),
    ],
  },
  // A staff login the same (the F15 audit): 2FA stands behind it, but a password
  // tried from many addresses meets the same proof as a shopper's
  {
    matcher: "/auth/user/emailpass",
    methods: ["POST" as const],
    middlewares: [challengeAfterAttempts({ max: 5, windowMs: 15 * MINUTE }, "staff_login")],
  },
  // An account made after a sign-in elsewhere (Google) names its address here
  {
    matcher: "/store/customers",
    methods: ["POST" as const],
    middlewares: [refuseBlocked("refused")],
  },
  {
    matcher: "/store/order-lookup",
    methods: ["POST" as const],
    middlewares: [challengeOver("order_lookup", { max: 5, windowMs: HOUR })],
  },
  {
    matcher: "/store/stock-alerts",
    methods: ["POST" as const],
    middlewares: [challengeOver("stock_alert", { max: 5, windowMs: HOUR })],
  },
  { matcher: "/admin/orders/:id/fulfillments", middlewares: [refuseHeldOrder] },
  { matcher: "/admin/fulfillments", middlewares: [refuseHeldOrder] },
  {
    matcher: "/admin/fraud/reviews",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetFraudReviews, {})],
  },
  {
    matcher: "/admin/fraud/reviews/:id/decision",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostFraudDecision)],
  },
  {
    matcher: "/admin/fraud/blocks",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetFraudBlocks, {})],
  },
  {
    matcher: "/admin/fraud/blocks",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostFraudBlock)],
  },
]
