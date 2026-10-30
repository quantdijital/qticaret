import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ConflictError } from "../../lib/errors"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import type { CookieChoice } from "../../modules/legal/service"

type Container = Pick<MedusaContainer, "resolve">

const legal = (container: Container) => container.resolve<LegalModuleService>(LEGAL_MODULE)

/** The cookie policy's version in force; null while the shop has published none. */
export async function cookiePolicyVersion(container: Container): Promise<number | null> {
  return (await legal(container).versionOf("cookie_policy", "published"))?.version ?? null
}

/** A cookie banner answer as the storefront reads it back: the necessary ones always on. */
export const cookieConsentView = (row: {
  analytics: boolean
  marketing: boolean
  policy_version: number | null
  given_at: Date | string
}) => ({
  necessary: true,
  analytics: row.analytics,
  marketing: row.marketing,
  policy_version: row.policy_version,
  given_at: new Date(row.given_at).toISOString(),
})

/**
 * Records the visitor's answer under the cookie policy the banner showed;
 * a policy published since is shown again first. Undone, the answer goes.
 */
const recordCookieConsentStep = createStep(
  "legal-record-cookie-consent",
  async (input: { visitor_hash: string } & CookieChoice, { container }) => {
    if (input.policy_version !== (await cookiePolicyVersion(container))) {
      throw new ConflictError("legal.version_changed")
    }
    const { visitor_hash: visitorHash, ...choice } = input
    const row = await legal(container).recordCookieConsent(visitorHash, choice)
    return new StepResponse(cookieConsentView(row), row.id)
  },
  async (id, { container }) => {
    if (id) {
      await legal(container).deleteCookieConsents([id])
    }
  }
)

/** adr/0041 §5: the cookie banner's answer, kept for the visitor. */
export const recordCookieConsentWorkflow = createWorkflow(
  "legal-record-cookie-consent",
  (input: { visitor_hash: string } & CookieChoice) =>
    new WorkflowResponse(recordCookieConsentStep(input))
)
