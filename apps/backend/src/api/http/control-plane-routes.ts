import { validateAndTransformBody } from "@medusajs/framework/http"
import { PLAN_DOCUMENT_MAX_BYTES, signedPlanDocumentSchema } from "@qticaret/types/control-plane"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { rateLimit } from "./rate-limit"

/**
 * adr/0061 §3.2, Ek C9: the control plane's plan document push. No secret
 * and no session: the document is signed, and the route checks the
 * signature, the shop id and the serial. The body is held to 16 KB before
 * it is parsed (413 past it), then to the contract's strict schema (an
 * unknown field is a 400); pushes are rate limited per address.
 */
export const CONTROL_PLANE_ROUTES = [
  {
    matcher: "/hooks/control-plane/plan",
    methods: ["POST" as const],
    bodyParser: { sizeLimit: PLAN_DOCUMENT_MAX_BYTES },
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.control_plane_push),
      validateAndTransformBody(signedPlanDocumentSchema),
    ],
  },
]
