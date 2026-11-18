import { validateAndTransformBody } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  BirfaturaCargoBody,
  BirfaturaInvoiceLinkBody,
  BirfaturaOrdersBody,
} from "../hooks/birfatura/validators"
import { birfaturaGuard } from "./birfatura-guard"
import { rateLimit } from "./rate-limit"

/**
 * adr/0072 §3: BirFatura's calls to the shop's services. No session: the
 * order is the guard's. The body is held to 16 KB before it is parsed
 * (413 past it); the pull's budget per address comes first, then the
 * guard (404 while BirFatura is not the shop's program, 429 for an
 * address past its wrong tokens, 401 for a wrong token), then the shop's
 * budget, then the schema (documented fields checked, others dropped),
 * never before the token.
 */
const BODY_LIMIT = { sizeLimit: "16kb" }
/**
 * The door in its order: the address's budget, the guard, then the shop's
 * budget. The shop's counts only calls that brought the token, so a flood
 * without it from many addresses cannot use up BirFatura's (security
 * review S1).
 */
export const birfaturaDoor = () => [
  rateLimit(() => RATE_LIMIT_PROFILES.einvoice_pull),
  birfaturaGuard(),
  rateLimit(() => RATE_LIMIT_PROFILES.einvoice_pull_shop, { identity: () => "shop" }),
]
const door = birfaturaDoor()

export const BIRFATURA_ROUTES = [
  {
    matcher: "/hooks/birfatura/api/orderStatus",
    methods: ["POST" as const],
    bodyParser: BODY_LIMIT,
    middlewares: door,
  },
  {
    matcher: "/hooks/birfatura/api/paymentMethods",
    methods: ["POST" as const],
    bodyParser: BODY_LIMIT,
    middlewares: door,
  },
  {
    matcher: "/hooks/birfatura/api/orders",
    methods: ["POST" as const],
    bodyParser: BODY_LIMIT,
    middlewares: [...door, validateAndTransformBody(BirfaturaOrdersBody)],
  },
  {
    matcher: "/hooks/birfatura/api/orderCargoUpdate",
    methods: ["POST" as const],
    bodyParser: BODY_LIMIT,
    middlewares: [...door, validateAndTransformBody(BirfaturaCargoBody)],
  },
  {
    matcher: "/hooks/birfatura/api/invoiceLinkUpdate",
    methods: ["POST" as const],
    bodyParser: BODY_LIMIT,
    middlewares: [...door, validateAndTransformBody(BirfaturaInvoiceLinkBody)],
  },
]
