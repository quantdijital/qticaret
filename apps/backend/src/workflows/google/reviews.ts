import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import { businessProfileApi } from "../../lib/google/business-profile"
import type { BusinessLocation } from "../../lib/google/business-profile"
import { googleApi } from "../../lib/google/client"
import { BUSINESS_PROFILE_SCOPE, googleClientOf, hasScope } from "../../lib/google/oauth"
import { GOOGLE_REVIEWS_MODULE } from "../../modules/google-reviews"
import type { HideReason } from "../../modules/google-reviews/models/google-review"
import type GoogleReviewsModuleService from "../../modules/google-reviews/service"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"

type Resolver = Pick<MedusaContainer, "resolve">

/** Accounts read at most when listing locations: an agency's account can reach many. */
const MAX_ACCOUNTS = 20

export const googleReviewsOf = (container: Resolver) =>
  container.resolve<GoogleReviewsModuleService>(GOOGLE_REVIEWS_MODULE)

/**
 * An access token for Business Profile from the shop's Google connection
 * (adr/0058); an error when it is not connected, or connected without
 * Business Profile's scope (the panel offers to connect again).
 */
export async function businessProfileToken(container: Resolver): Promise<string> {
  const client = googleClientOf()
  const account = await container
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .read("google")
  const refreshToken = account?.secrets["refresh_token"]
  if (!client || !refreshToken) {
    throw new ValidationError("google.not_connected")
  }
  if (!hasScope(account.settings["scopes"], BUSINESS_PROFILE_SCOPE)) {
    throw new ValidationError("google.reviews_scope")
  }
  return googleApi().accessToken(client, refreshToken)
}

/**
 * The Business Profile locations the shop's Google account manages, each
 * once (a location reached through several accounts keeps the first).
 */
export async function googleReviewLocations(container: Resolver): Promise<BusinessLocation[]> {
  const token = await businessProfileToken(container)
  const api = businessProfileApi()
  const accounts = (await api.listAccounts(token)).slice(0, MAX_ACCOUNTS)
  const found = new Map<string, BusinessLocation>()
  for (const account of accounts) {
    for (const location of await api.listLocations(token, account)) {
      if (!found.has(location.location)) {
        found.set(location.location, location)
      }
    }
  }
  return [...found.values()]
}

interface ChooseInput {
  account: string
  location: string
}

/**
 * Picks the location whose reviews the storefront shows: one the account
 * manages, as Google lists it now. Another location than before forgets
 * the reviews kept. Nothing to undo at Google (only read); the choice is
 * the workflow's last write.
 */
const chooseGoogleReviewLocationStep = createStep(
  "google-reviews-choose-location",
  async (input: ChooseInput, { container }) => {
    const listed = (await googleReviewLocations(container)).find(
      (each) => each.account === input.account && each.location === input.location
    )
    if (!listed) {
      throw new ValidationError("google.location_invalid", { field: "location" })
    }
    const { changed } = await googleReviewsOf(container).chooseLocation({
      account: listed.account,
      location: listed.location,
      title: listed.title,
      address: listed.address,
      maps_uri: listed.mapsUri,
      new_review_uri: listed.newReviewUri,
    })
    return new StepResponse({ location: listed.location, changed })
  }
)

export const chooseGoogleReviewLocationWorkflow = createWorkflow(
  "google-reviews-choose-location",
  (input: ChooseInput) => new WorkflowResponse(chooseGoogleReviewLocationStep(input))
)

/**
 * Forgets the location and its reviews: the storefront shows no Google
 * reviews. The Google connection itself stays (Merchant Center, Search
 * Console). Nothing to undo: Google keeps the reviews, a sync reads them.
 */
export const forgetGoogleReviewsStep = createStep(
  "google-reviews-forget",
  async (_input: Record<string, never>, { container }) => {
    const removed = await googleReviewsOf(container).forgetAll()
    return new StepResponse({ removed })
  }
)

export const forgetGoogleReviewsWorkflow = createWorkflow(
  "google-reviews-forget",
  (input: Record<string, never>) => new WorkflowResponse(forgetGoogleReviewsStep(input))
)

export type SetGoogleReviewHiddenInput =
  | { id: string; hidden: true; reason: HideReason; user_id: string }
  | { id: string; hidden: false; user_id: string }

/**
 * Takes one Google review off the storefront for one of the three reasons
 * (personal data, abuse, off topic; adr/0058 Ek), with who and when, or
 * puts it back. Never by its stars: a reason is required, and one review
 * at a time. The route's audit entry records it (`google_review`).
 * Undone by putting its visibility back as it was.
 */
const setGoogleReviewHiddenStep = createStep(
  "google-reviews-set-hidden",
  async (input: SetGoogleReviewHiddenInput, { container }) => {
    const previous = await googleReviewsOf(container).setVisibility(
      input.id,
      input.hidden ? { hidden: true, reason: input.reason, by: input.user_id } : { hidden: false }
    )
    if (!previous) {
      throw new ValidationError("google.review_not_found")
    }
    return new StepResponse(
      { id: input.id, hidden: input.hidden, reason: input.hidden ? input.reason : null },
      { id: input.id, previous }
    )
  },
  async (undo, { container }) => {
    if (undo) {
      await googleReviewsOf(container).restoreVisibility(undo.id, undo.previous)
    }
  }
)

export const setGoogleReviewHiddenWorkflow = createWorkflow(
  "google-reviews-set-hidden",
  (input: SetGoogleReviewHiddenInput) => new WorkflowResponse(setGoogleReviewHiddenStep(input))
)
