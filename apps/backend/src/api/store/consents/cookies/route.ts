import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parseEnv } from "../../../../lib/env"
import { newVisitorId, visitorCookie, visitorIdOf } from "../../../../lib/legal/visitor"
import { LEGAL_MODULE } from "../../../../modules/legal"
import type LegalModuleService from "../../../../modules/legal/service"
import {
  cookieConsentView,
  cookiePolicyVersion,
  recordCookieConsentWorkflow,
} from "../../../../workflows/legal/cookies"
import type { StorePostCookieConsentType } from "./validators"

/**
 * GET /store/consents/cookies (F13.8, adr/0041 §5): the visitor's answer
 * in force and the cookie policy's version now. The banner asks again when
 * there is no answer, or one given under an older policy.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const visitorId = visitorIdOf(req.headers.cookie)
  const [latest, policyVersion] = await Promise.all([
    visitorId
      ? req.scope.resolve<LegalModuleService>(LEGAL_MODULE).latestCookieConsent(visitorId)
      : null,
    cookiePolicyVersion(req.scope),
  ])
  res.setHeader("Cache-Control", "no-store")
  res.json({ consent: latest ? cookieConsentView(latest) : null, policy_version: policyVersion })
}

/**
 * POST /store/consents/cookies: the visitor's answer, kept beside the ones
 * before. A visitor without our cookie gets one: random, HttpOnly,
 * SameSite=Lax, thirteen months; each answer renews it.
 */
export async function POST(
  req: MedusaRequest<StorePostCookieConsentType>,
  res: MedusaResponse
): Promise<void> {
  const visitorId = visitorIdOf(req.headers.cookie) ?? newVisitorId()
  const { result } = await recordCookieConsentWorkflow(req.scope).run({
    input: { visitor_id: visitorId, ...req.validatedBody },
  })
  const secure = req.secure || parseEnv().NODE_ENV === "production"
  res.setHeader("Set-Cookie", visitorCookie(visitorId, secure))
  res.setHeader("Cache-Control", "no-store")
  res.json({ consent: result })
}
