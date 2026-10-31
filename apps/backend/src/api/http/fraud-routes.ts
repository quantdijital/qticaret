import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
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
import { challengeAfterFailures, challengeOver } from "./challenge"
import { rejectRequest } from "./reject"

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

/** Medusa's own fulfillment route ships too: a held order is refused there as in "Kargoya ver". */
async function refuseHeldOrder(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  if (req.method !== "POST") {
    next()
    return
  }
  try {
    const held = await req.scope
      .resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE)
      .heldStatus(req.params["id"] ?? "")
    next(held ? new ValidationError(`fraud.review_${held}`) : undefined)
  } catch (error) {
    next(error)
  }
}

let key: Buffer | undefined
const keyOf = () => (key ??= parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY"))

/**
 * A registration or a sign-in from an e-mail, a domain or an address on
 * the shop's block list (adr/0044 §4) stops, with a sentence that does not
 * say why. The block list out of reach lets it through, logged.
 */
async function refuseBlocked(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const email = (req.body as { email?: unknown } | undefined)?.email
  if (req.method !== "POST") {
    next()
    return
  }
  try {
    const blocked = await req.scope.resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE).blockedBy(
      matchesOf(
        {
          email: typeof email === "string" ? email : null,
          ip: req.ip ?? req.socket.remoteAddress ?? null,
        },
        keyOf()
      )
    )
    if (blocked) {
      logger.warn({ event: "fraud.account_blocked", kind: blocked.kind })
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

/**
 * F15.6 (adr/0044): proofs of work past each scope's soft limit, the held
 * orders' queue and the block list. The checkout's guard sits in the
 * cart's completion chain (payment-routes). Matchers on Medusa's own
 * routes have no `methods`, so they run before its handler.
 */
export const FRAUD_ROUTES = [
  {
    matcher: "/auth/customer/emailpass/register",
    middlewares: [refuseBlocked, challengeOver("register", { max: 3, windowMs: HOUR })],
  },
  {
    matcher: "/auth/customer/emailpass",
    middlewares: [refuseBlocked, challengeAfterFailures({ max: 3, windowMs: 15 * MINUTE })],
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
