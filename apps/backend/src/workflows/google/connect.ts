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
  GOOGLE_CALLBACK_PATH,
  authorizationUrl,
  googleClientOf,
  pkcePair,
} from "../../lib/google/oauth"
import { errorSummary, logger } from "../../lib/logging"
import { GOOGLE_MERCHANT_MODULE } from "../../modules/google-merchant"
import type GoogleMerchantModuleService from "../../modules/google-merchant/service"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"

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
const startGoogleConnectStep = createStep(
  "google-start-connect",
  async (input: { user_id: string }, { container }) => {
    const client = requireClient()
    const { verifier, challenge } = pkcePair()
    const state = await container
      .resolve<GoogleMerchantModuleService>(GOOGLE_MERCHANT_MODULE)
      .startState(input.user_id, verifier)
    return new StepResponse({
      url: authorizationUrl(client, { state, challenge, redirectUri: redirectUri() }),
    })
  }
)

export const startGoogleConnectWorkflow = createWorkflow(
  "google-start-connect",
  (input: { user_id: string }) => new WorkflowResponse(startGoogleConnectStep(input))
)

interface Exchanged {
  refresh_token: string
  email: string | null
  /** What the shop allowed, space-separated: Search Console may be missing. */
  scopes: string | null
  user_id: string
}

/**
 * Trades the code Google sent back for the shop's refresh token, with the
 * verifier of its `state` (used once). Undone by revoking the token at
 * Google, so a connection that is not kept leaves no access behind.
 */
const exchangeGoogleCodeStep = createStep(
  "google-exchange-code",
  async (input: { state: string; code: string }, { container }) => {
    const client = requireClient()
    const taken = await container
      .resolve<GoogleMerchantModuleService>(GOOGLE_MERCHANT_MODULE)
      .takeState(input.state)
    if (!taken) {
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
    const exchanged: Exchanged = {
      refresh_token: answer.refreshToken,
      email: answer.email,
      scopes: answer.scopes,
      user_id: taken.user_id,
    }
    return new StepResponse(exchanged, answer.refreshToken)
  },
  async (refreshToken) => {
    if (refreshToken) {
      await googleApi()
        .revoke(refreshToken)
        .catch((error: unknown) => {
          logger.warn({ event: "google.revoke_failed", err: errorSummary(error) })
        })
    }
  }
)

/**
 * Keeps the refresh token with the shop's provider accounts (adr/0027),
 * encrypted; the Merchant Center account named before stays. Undone by
 * putting the account back as it was.
 */
const storeGoogleConnectionStep = createStep(
  "google-store-connection",
  async (input: Exchanged, { container }) => {
    const credentials = container.resolve<IntegrationCredentialsModuleService>(
      INTEGRATION_CREDENTIALS_MODULE
    )
    const current = await credentials.read("google")
    const kept = current?.settings ?? {}
    const draft = await credentials.draft("google", {
      settings: {
        ...kept,
        ...(input.email ? { email: input.email } : {}),
        ...(input.scopes ? { scopes: input.scopes.slice(0, 2000) } : {}),
      },
      secrets: { refresh_token: input.refresh_token },
    })
    const previous = await credentials.store(draft, "verified", input.user_id)
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
  (input: { state: string; code: string }) =>
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
