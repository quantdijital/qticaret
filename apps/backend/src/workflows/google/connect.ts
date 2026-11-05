import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { backendUrl } from "../../lib/env"
import { ValidationError } from "../../lib/errors"
import { googleApi } from "../../lib/google/client"
import {
  BUSINESS_PROFILE_SCOPE,
  GOOGLE_CALLBACK_PATH,
  REVIEWS_STATE_PREFIX,
  authorizationUrl,
  googleClientOf,
  pkcePair,
} from "../../lib/google/oauth"
import { errorSummary, logger } from "../../lib/logging"
import { GOOGLE_MERCHANT_MODULE } from "../../modules/google-merchant"
import type GoogleMerchantModuleService from "../../modules/google-merchant/service"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import type { CredentialDraft } from "../../modules/integration-credentials/types"

const redirectUri = () => `${backendUrl()}${GOOGLE_CALLBACK_PATH}`

const requireClient = () => {
  const client = googleClientOf()
  if (!client) {
    throw new ValidationError("google.not_configured")
  }
  return client
}

/**
 * Where to send the staff member to connect the shop's Google account
 * (F10 M13, adr/0038 §5): a new `state` and PKCE verifier, kept on the
 * server for ten minutes. Nothing to undo: an unused state expires.
 */
interface StartInput {
  user_id: string
  /** `reviews`: Business Profile's scope asked on top, back to the panel's Google reviews (adr/0058). */
  purpose?: "reviews"
}

const startGoogleConnectStep = createStep(
  "google-start-connect",
  async (input: StartInput, { container }) => {
    const client = requireClient()
    const reviews = input.purpose === "reviews"
    const { verifier, challenge } = pkcePair()
    const state = await container
      .resolve<GoogleMerchantModuleService>(GOOGLE_MERCHANT_MODULE)
      .startState(input.user_id, verifier, reviews ? REVIEWS_STATE_PREFIX : "")
    return new StepResponse({
      url: authorizationUrl(client, {
        state,
        challenge,
        redirectUri: redirectUri(),
        ...(reviews ? { extraScopes: [BUSINESS_PROFILE_SCOPE] } : {}),
      }),
    })
  }
)

export const startGoogleConnectWorkflow = createWorkflow(
  "google-start-connect",
  (input: StartInput) => new WorkflowResponse(startGoogleConnectStep(input))
)

interface FinishInput {
  state: string
  code: string
  /** The staff member back from Google's screen: only the one who started may finish. */
  user_id: string | null
}

/**
 * Trades the code Google sent back for the shop's refresh token, with the
 * verifier of its `state` (used once, by the staff member who started
 * it), and seals it at once with the account's settings (adr/0027): no
 * step's output or input holds it in the clear. Undone by revoking the
 * token at Google, so a connection that is not kept leaves no access
 * behind.
 */
const exchangeGoogleCodeStep = createStep(
  "google-exchange-code",
  async (input: FinishInput, { container }) => {
    const client = requireClient()
    const taken = await container
      .resolve<GoogleMerchantModuleService>(GOOGLE_MERCHANT_MODULE)
      .takeState(input.state)
    if (!taken || !input.user_id || taken.user_id !== input.user_id) {
      throw new ValidationError("google.state_invalid")
    }
    const answer = await googleApi().exchangeCode(client, {
      code: input.code,
      verifier: taken.verifier,
      redirectUri: redirectUri(),
    })
    if (!answer.refreshToken) {
      throw new ValidationError("google.no_refresh_token")
    }
    const credentials = container.resolve<IntegrationCredentialsModuleService>(
      INTEGRATION_CREDENTIALS_MODULE
    )
    const kept = (await credentials.read("google"))?.settings ?? {}
    const draft = await credentials.draft("google", {
      settings: {
        ...kept,
        ...(answer.email ? { email: answer.email } : {}),
        ...(answer.scopes ? { scopes: answer.scopes.slice(0, 2000) } : {}),
      },
      secrets: { refresh_token: answer.refreshToken },
    })
    return new StepResponse({ draft, email: answer.email, user_id: taken.user_id }, draft)
  },
  async (draft, { container }) => {
    if (!draft) {
      return
    }
    const token = container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .openDraft(draft).secrets["refresh_token"]
    if (token) {
      await googleApi()
        .revoke(token)
        .catch((error: unknown) => {
          logger.warn({ event: "google.revoke_failed", err: errorSummary(error) })
        })
    }
  }
)

/**
 * Keeps the sealed refresh token with the shop's provider accounts
 * (adr/0027); the Merchant Center account named before stays. Undone by
 * putting the account back as it was.
 */
const storeGoogleConnectionStep = createStep(
  "google-store-connection",
  async (
    input: { draft: CredentialDraft; email: string | null; user_id: string },
    { container }
  ) => {
    const previous = await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .store(input.draft, "verified", input.user_id)
    return new StepResponse({ connected: true, email: input.email }, { previous })
  },
  async (undo, { container }) => {
    if (undo) {
      await container
        .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
        .restore("google", undo.previous)
    }
  }
)

/** Google's answer to the consent screen, made the shop's connection (F10 M13). */
export const finishGoogleConnectWorkflow = createWorkflow(
  "google-finish-connect",
  (input: FinishInput) =>
    new WorkflowResponse(storeGoogleConnectionStep(exchangeGoogleCodeStep(input)))
)

/** Drops a `state` Google sent back with a refusal: the staff member said no. */
const dropGoogleStateStep = createStep(
  "google-drop-state",
  async (input: { state: string }, { container }) => {
    await container
      .resolve<GoogleMerchantModuleService>(GOOGLE_MERCHANT_MODULE)
      .takeState(input.state)
    return new StepResponse({ dropped: true })
  }
)

export const dropGoogleStateWorkflow = createWorkflow(
  "google-drop-state",
  (input: { state: string }) => new WorkflowResponse(dropGoogleStateStep(input))
)
