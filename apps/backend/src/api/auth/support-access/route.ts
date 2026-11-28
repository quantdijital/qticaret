import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { SupportAccessRequest } from "@qticaret/types/control-plane"
import { controlPlaneConfig } from "../../../lib/control-plane/config"
import { errorSummary, logger } from "../../../lib/logging"
import { checkSupportGrant } from "../../../lib/support-access/grant"
import { sessionOfGrant } from "../../../lib/support-access/session"
import { recordSupportEvent, startSupportSessionWorkflow } from "../../../workflows/support-access"
import { SESSION_SIGNED_IN_AT } from "../../http/sign-in-epoch"
import { factsOf, supportEnabled } from "../../http/support-guard"

const STATUS_OF: Readonly<Record<string, number>> = {
  "support.grant_invalid": 400,
  "signature.malformed": 401,
  "signature.unknown_key": 401,
  "signature.invalid": 401,
  "support.wrong_tenant": 403,
  "support.grant_expired": 401,
  "support.disabled": 403,
  "support.grant_used": 409,
}

interface BrowserSession {
  auth_context?: unknown
  regenerate: (callback: (error?: unknown) => void) => void
  save: (callback: (error?: unknown) => void) => void
}

const callback = (run: (done: (error?: unknown) => void) => void) =>
  new Promise<void>((resolve, reject) => {
    run((error) => {
      if (error) {
        reject(error instanceof Error ? error : new Error("session_store"))
      } else {
        resolve()
      }
    })
  })

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** The workflow's refusal of a grant seen before, however the engine carried the error. */
const usedGrant = (error: unknown): boolean => {
  const failure = error as { safeMessage?: unknown; message?: unknown } | null
  return `${textOf(failure?.safeMessage)} ${textOf(failure?.message)}`.includes(
    "support.grant_used"
  )
}

/**
 * POST /auth/support-access (adr/0061 Ek "Destek erişimi", Karar 3): the
 * control plane's signed grant, from the panel's `/support` page, becomes
 * a time-limited "Platform desteği" session. Checked in order: managed
 * shop (404 otherwise), shape, signature by `kid`, this shop's panel, its
 * times, the owner's switch, single use. Each refusal is audited without
 * the grant. On success the browser's session is renewed (no fixation) and
 * holds the synthetic identity until the grant's end; the owners are told.
 */
export async function POST(
  req: MedusaRequest<SupportAccessRequest>,
  res: MedusaResponse
): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  const config = controlPlaneConfig()
  if (!config.managed) {
    res.status(404).json({ type: "not_found", message: "support.unmanaged" })
    return
  }
  const facts = factsOf(req)
  const refuse = async (code: string, grantId: string | null) => {
    await recordSupportEvent(req.scope, {
      action: "support_access.refused",
      grant_id: grantId,
      actor_id: null,
      outcome: STATUS_OF[code] ?? 400,
      changes: { code },
      facts,
    }).catch((error: unknown) => {
      logger.warn({ event: "support_access.audit_failed", err: errorSummary(error) })
    })
    res
      .status(STATUS_OF[code] ?? 400)
      .json({ type: code === "support.grant_used" ? "conflict" : "not_allowed", message: code })
  }
  const checked = checkSupportGrant(req.validatedBody.grant, {
    publicKeys: config.publicKeys,
    tenantId: config.tenantId,
    now: Math.floor(Date.now() / 1000),
  })
  if (!checked.ok) {
    await refuse(checked.code, null)
    return
  }
  const { grant } = checked
  if (!(await supportEnabled(req))) {
    await refuse("support.disabled", grant.grant_id)
    return
  }
  let session
  try {
    const { result } = await startSupportSessionWorkflow(req.scope).run({
      input: { session: sessionOfGrant(grant, new Date()), facts },
    })
    session = result
  } catch (error) {
    if (usedGrant(error)) {
      await refuse("support.grant_used", grant.grant_id)
      return
    }
    throw error
  }
  const browser = (req as unknown as { session: BrowserSession }).session
  await callback((done) => {
    browser.regenerate(done)
  })
  const renewed = (req as unknown as { session: BrowserSession & Record<string, unknown> }).session
  renewed.auth_context = {
    actor_id: session.actor_id,
    actor_type: "user",
    auth_identity_id: "",
    app_metadata: {},
    user_metadata: {},
    // The control plane's own 2FA and its step-up for this grant stand in for the shop's
    mfa_challenge_completed_at: new Date().toISOString(),
  }
  renewed[SESSION_SIGNED_IN_AT] = Math.floor(Date.now() / 1000)
  await callback((done) => {
    renewed.save(done)
  })
  res.json({ support: { expires_at: session.expires_at } })
}
