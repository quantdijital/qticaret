import type { MedusaContainer } from "@medusajs/framework/types"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { IYZICO_PAYMENT_PROVIDER_ID, PAYTR_PAYMENT_PROVIDER_ID } from "./checkout"
import { iyzicoCredentialsOf } from "./iyzico"
import { paytrCredentialsOf } from "./paytr"
import { integrationHealth } from "../integrations/health"
import { paymentSettings } from "./settings"

export type CardProvider = "paytr" | "iyzico"

export const CARD_PROVIDER_IDS: Readonly<Record<CardProvider, string>> = {
  paytr: PAYTR_PAYMENT_PROVIDER_ID,
  iyzico: IYZICO_PAYMENT_PROVIDER_ID,
}

const ORDER: readonly CardProvider[] = ["paytr", "iyzico"]

/**
 * The card providers whose account the shop has stored, the shop's choice
 * first (F5 V10, `payments.card_provider`). The storefront offers them in
 * this order; the first prices installments.
 */
export async function connectedCardProviders(container: MedusaContainer): Promise<CardProvider[]> {
  const accounts = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  const [paytr, iyzico, settings] = await Promise.all([
    accounts.read("paytr"),
    accounts.read("iyzico"),
    paymentSettings(container),
  ])
  const stored = new Set<CardProvider>([
    ...(paytrCredentialsOf(paytr) ? (["paytr"] as const) : []),
    ...(iyzicoCredentialsOf(iyzico) ? (["iyzico"] as const) : []),
  ])
  const chosen = settings.card_provider
  return ORDER.filter((provider) => stored.has(provider)).sort(
    (a, b) => Number(b === chosen) - Number(a === chosen)
  )
}

export interface RoutedCardProvider {
  provider: CardProvider
  /** False when the integrations health check finds it down (F6.3). */
  healthy: boolean
}

/**
 * The connected card providers as the storefront should try them (F6.2,
 * F6.3): the shop's choice first, but one the health check finds down goes
 * behind the others, so a checkout completes with the backup. With one
 * provider there is nothing to route: no check is run.
 */
export async function routedCardProviders(
  container: MedusaContainer
): Promise<RoutedCardProvider[]> {
  const providers = await connectedCardProviders(container)
  if (providers.length < 2) {
    return providers.map((provider) => ({ provider, healthy: true }))
  }
  const accounts = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  const report = await integrationHealth(accounts).report()
  const down = new Set(
    report.checks.filter((check) => check.status === "down").map((check) => check.id)
  )
  const routed = providers.map((provider) => ({ provider, healthy: !down.has(provider) }))
  return [...routed.filter(({ healthy }) => healthy), ...routed.filter(({ healthy }) => !healthy)]
}
