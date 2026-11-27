import { createHash } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError, isProviderError } from "../../lib/errors"
import { excludedBy, googleFeedFormatter } from "../../lib/feeds"
import { googleApi } from "../../lib/google/client"
import { productInputName, productInputOf } from "../../lib/google/merchant"
import { googleClientOf } from "../../lib/google/oauth"
import { checkAccount } from "../../lib/integrations/account-check"
import { errorSummary, logger } from "../../lib/logging"
import { GOOGLE_MERCHANT_MODULE } from "../../modules/google-merchant"
import type GoogleMerchantModuleService from "../../modules/google-merchant/service"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { catalogItems, feedShopOf } from "../marketing/feed-catalog"
import { brandOf } from "../messaging/brand"

/** Calls to Merchant API in one run at most; the rest go in the next. */
const MAX_CALLS = 1000

const credentialsOf = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)

/**
 * Names the shop's Merchant Center account (F10 M13): checked first with
 * Google, the connected account must reach it; a new account gets a new
 * data source. Undone by putting the connection back as it was.
 */
const saveMerchantAccountStep = createStep(
  "google-save-merchant-account",
  async (input: { merchant_id: string; user_id: string }, { container }) => {
    const credentials = credentialsOf(container)
    const current = await credentials.read("google")
    if (!current) {
      throw new ValidationError("google.not_connected")
    }
    const same = current.settings["merchant_id"] === input.merchant_id
    const settings: Record<string, unknown> = {
      ...current.settings,
      merchant_id: input.merchant_id,
    }
    if (!same) {
      delete settings["data_source"]
    }
    const draft = await credentials.draft("google", { settings })
    const check = await checkAccount("google", await credentials.openDraft(draft))
    if (check !== "valid") {
      throw new ValidationError(
        check === "unreachable"
          ? "integration_credentials.provider_unreachable"
          : `google.${check === "merchant_invalid" ? "merchant_invalid" : "secret_invalid"}`,
        { field: "merchant_id" }
      )
    }
    const previous = await credentials.store(draft, "verified", input.user_id)
    return new StepResponse({ merchant_id: input.merchant_id }, { previous })
  },
  async (undo, { container }) => {
    if (undo) {
      await credentialsOf(container).restore("google", undo.previous)
    }
  }
)

export const saveMerchantAccountWorkflow = createWorkflow(
  "google-save-merchant-account",
  (input: { merchant_id: string; user_id: string }) =>
    new WorkflowResponse(saveMerchantAccountStep(input))
)

export interface MerchantSyncResult {
  sent: number
  removed: number
  failed: number
  error: string | null
  ran: boolean
}

const hashOf = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex")

/**
 * Sends the shop's products to its Merchant Center through Merchant API
 * (F10 M13, adr/0038 §3): the Google feed's own items, each only when it
 * changed since it was last sent, and removes those no longer sold. An
 * item Google refuses is counted and left; a refusal of the account or
 * Google out of reach stops the run. Nothing to undo: an insert replaces
 * the same offer, and an offer is recorded only after Google took it.
 */
const syncMerchantProductsStep = createStep(
  "google-sync-merchant-products",
  async (input: { trigger: "schedule" | "panel" }, { container }) => {
    const idle: MerchantSyncResult = { sent: 0, removed: 0, failed: 0, error: null, ran: false }
    const client = googleClientOf()
    const credentials = credentialsOf(container)
    const account = await credentials.read("google")
    const refreshToken = account?.secrets["refresh_token"]
    const merchantId = account?.settings["merchant_id"]
    const brand = await brandOf(container)
    if (
      !client ||
      !account ||
      !refreshToken ||
      typeof merchantId !== "string" ||
      !brand.storefrontUrl
    ) {
      return new StepResponse(idle)
    }
    const merchant = container.resolve<GoogleMerchantModuleService>(GOOGLE_MERCHANT_MODULE)
    const api = googleApi()
    const result: MerchantSyncResult = { ...idle, ran: true }
    try {
      const token = await api.accessToken(client, refreshToken)
      // One data source, even when the schedule's run and the panel's start together
      const dataSource = await container
        .resolve(Modules.LOCKING)
        .execute("google:merchant-data-source", async () => {
          const settings = (await credentials.read("google"))?.settings ?? account.settings
          const stored = settings["data_source"]
          if (typeof stored === "string") {
            return stored
          }
          const created = await api.createDataSource(token, merchantId)
          const draft = await credentials.draft("google", {
            settings: { ...settings, data_source: created },
          })
          await credentials.store(draft, null, null)
          return created
        })
      // What the Google feed lists, as it says it: its exclusions and the shop's shipping too
      const [catalog, { shop, exclusions }] = await Promise.all([
        catalogItems(container, brand.storefrontUrl),
        feedShopOf(container, { shopName: brand.shopName, storefrontUrl: brand.storefrontUrl }),
      ])
      const items = catalog.filter(
        (item) => googleFeedFormatter.accepts(item) && !excludedBy(item, exclusions.google)
      )
      const sent = await merchant.sentOffers()
      let calls = 0
      for (const item of items) {
        const productInput = productInputOf(item, shop)
        const hash = hashOf(productInput)
        if (sent.get(item.id) === hash || calls >= MAX_CALLS) {
          continue
        }
        calls += 1
        try {
          await api.insertProduct(token, merchantId, dataSource, productInput)
          await merchant.recordOffer(item.id, hash)
          result.sent += 1
        } catch (error) {
          // Google refused this item's values: the next run tries it again
          if (isProviderError(error) && error.providerCode === "INVALID_ARGUMENT") {
            result.failed += 1
            continue
          }
          throw error
        }
      }
      const listed = new Set(items.map((item) => item.id))
      const gone = [...sent.keys()].filter((offerId) => !listed.has(offerId))
      for (const offerId of gone.slice(0, Math.max(0, MAX_CALLS - calls))) {
        try {
          await api.deleteProduct(token, productInputName(merchantId, offerId), dataSource)
        } catch (error) {
          if (!(isProviderError(error) && error.providerCode === "NOT_FOUND")) {
            throw error
          }
        }
        await merchant.forgetOffers([offerId])
        result.removed += 1
      }
    } catch (error) {
      result.error = isProviderError(error) ? error.providerCode : "failed"
      logger.warn({ event: "google.merchant_sync_stopped", err: errorSummary(error) })
    }
    await merchant.recordSync(result)
    logger.info({ event: "google.merchant_synced", trigger: input.trigger, ...result })
    return new StepResponse(result)
  }
)

/** The shop's products sent to its Merchant Center (F10 M13). */
export const syncMerchantProductsWorkflow = createWorkflow(
  "google-sync-merchant-products",
  (input: { trigger: "schedule" | "panel" }) =>
    new WorkflowResponse(syncMerchantProductsStep(input))
)

/**
 * Disconnects the shop's Google account: its access ends at Google, the
 * refresh token and what we sent are forgotten here. The products stay in
 * Merchant Center until Google lets them lapse or the shop removes them.
 * Undone by putting the account back; a revoked token stays revoked.
 */
const disconnectGoogleStep = createStep(
  "google-disconnect",
  async (_input: { user_id: string }, { container }) => {
    const credentials = credentialsOf(container)
    const refreshToken = (await credentials.read("google"))?.secrets["refresh_token"]
    if (refreshToken) {
      await googleApi()
        .revoke(refreshToken)
        .catch((error: unknown) => {
          logger.warn({ event: "google.revoke_failed", err: errorSummary(error) })
        })
    }
    const previous = await credentials.remove("google")
    await container.resolve<GoogleMerchantModuleService>(GOOGLE_MERCHANT_MODULE).forgetOffers("all")
    return new StepResponse({ disconnected: previous !== null }, { previous })
  },
  async (undo, { container }) => {
    if (undo?.previous) {
      await credentialsOf(container).restore("google", undo.previous)
    }
  }
)

export const disconnectGoogleWorkflow = createWorkflow(
  "google-disconnect",
  (input: { user_id: string }) => new WorkflowResponse(disconnectGoogleStep(input))
)
