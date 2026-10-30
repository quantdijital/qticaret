import type { MedusaContainer } from "@medusajs/framework/types"
import { ValidationError, isProviderError } from "../../lib/errors"
import {
  createParasutApi,
  createParasutOauth,
  parasutClientOf,
  parasutThrottle,
} from "../../lib/invoicing/parasut"
import type { ParasutApi } from "../../lib/invoicing/parasut"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import { sharedRateLimitStore } from "../../api/http/rate-limit"

type Container = Pick<MedusaContainer, "resolve">

/** The platform's Paraşüt client, or why there is none (adr/0034 §5). */
export function requireParasutClient() {
  const client = parasutClientOf()
  if (!client) {
    throw new ValidationError("einvoice.parasut_unavailable")
  }
  return client
}

/** Paraşüt's API for a company, its requests counted in the shop's shared window. */
export const parasutApiFor = (companyId: string): ParasutApi =>
  createParasutApi(companyId, { throttle: parasutThrottle(sharedRateLimitStore(), companyId) })

/**
 * Runs calls to the shop's Paraşüt company with a live access token: the
 * stored one, or a fresh pair traded under the connection's lock. A token
 * Paraşüt turns away before its time is refreshed once and `run` is called
 * again from the start, so `run` holds reads and at most one write, the
 * last. No connection, or one Paraşüt refused, is a ValidationError the
 * panel names.
 */
export async function withParasut<T>(
  container: Container,
  run: (api: ParasutApi, token: string, companyId: string) => Promise<T>
): Promise<T> {
  const client = requireParasutClient()
  const oauth = createParasutOauth()
  const service = container.resolve<EinvoiceModuleService>(EINVOICE_MODULE)
  const access = async (refused?: string) => {
    const answer = await service.parasutAccess(
      (refreshToken) => oauth.refresh(client, refreshToken),
      refused ? { refused } : {}
    )
    if ("problem" in answer) {
      throw new ValidationError(answer.problem)
    }
    return answer
  }
  const first = await access()
  const api = parasutApiFor(first.company_id)
  try {
    return await run(api, first.token, first.company_id)
  } catch (error) {
    if (!isProviderError(error) || error.providerCode !== "unauthorized") {
      throw error
    }
    const second = await access(first.token)
    return run(api, second.token, second.company_id)
  }
}
