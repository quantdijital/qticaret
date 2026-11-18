import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { perIpScale } from "@qticaret/server-kit"
import { birfaturaTokenMatches, tokenFromHeader } from "../../lib/invoicing/birfatura"
import { errorSummary, logger } from "../../lib/logging"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import type { RateLimitStore } from "../../lib/security/rate-limit"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { InvoicingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { clientBucket, sharedRateLimitStore } from "./rate-limit"
import { logRejection, rejectRequest } from "./reject"
import { ensureRequestId } from "./request-id"

/**
 * The door to BirFatura's services (adr/0072 §3), before a byte of the
 * body is read:
 * 1. BirFatura not the shop's program, or no token made yet: 404, as if
 *    the services did not exist.
 * 2. An address past its budget of wrong tokens: 429, whatever it sends now.
 * 3. The `token` header against the stored token, in constant time; missing
 *    or wrong: 401 with no body, counted against the address.
 * The token is never logged, echoed or read from anywhere but the header.
 */

const FAILURES = RATE_LIMIT_PROFILES.einvoice_pull_auth

export interface BirfaturaGuardOptions {
  store?: () => RateLimitStore
  scale?: number
}

async function storedToken(req: MedusaRequest): Promise<string | null> {
  const { values } = await req.scope
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .readSection("invoicing")
  if ((values as unknown as InvoicingSettings).provider !== "birfatura") {
    return null
  }
  const account = await req.scope
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .read("birfatura")
  return account?.secrets["token"] ?? null
}

/** The address's wrong tries in this window; 0 when the store cannot say (fails open, logged). */
async function failuresOf(store: RateLimitStore, key: string): Promise<number> {
  try {
    return await store.peek(key)
  } catch (error) {
    logger.error({ event: "birfatura.failure_count_failed", err: errorSummary(error) })
    return 0
  }
}

async function countFailure(store: RateLimitStore, key: string): Promise<void> {
  try {
    await store.hit(key, FAILURES.perIp.windowMs)
  } catch (error) {
    logger.error({ event: "birfatura.failure_count_failed", err: errorSummary(error) })
  }
}

export function birfaturaGuard(options: BirfaturaGuardOptions = {}) {
  const scale = options.scale ?? perIpScale()
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const stored = await storedToken(req)
    if (!stored) {
      rejectRequest(
        req,
        res,
        404,
        { type: "not_found", message: "errors.not_found" },
        "birfatura_off"
      )
      return
    }
    const store = (options.store ?? sharedRateLimitStore)()
    const key = `${FAILURES.name}:ip:${clientBucket(req)}`
    if ((await failuresOf(store, key)) >= FAILURES.perIp.max * scale) {
      res.setHeader("Retry-After", String(Math.ceil(FAILURES.perIp.windowMs / 1000)))
      rejectRequest(
        req,
        res,
        429,
        { type: "too_many_requests", message: "errors.too_many_requests" },
        "rate_limit_einvoice_pull_auth"
      )
      return
    }
    if (!birfaturaTokenMatches(tokenFromHeader(req.headers["token"]), stored)) {
      await countFailure(store, key)
      logRejection(req, ensureRequestId(req, res), {
        status: 401,
        type: "unauthorized",
        reason: "birfatura_token",
      })
      res.status(401).end()
      return
    }
    next()
  }
}
