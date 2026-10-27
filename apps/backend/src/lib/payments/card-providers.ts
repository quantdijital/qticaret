import type { MedusaContainer } from "@medusajs/framework/types"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { PaymentSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { IYZICO_PAYMENT_PROVIDER_ID, PAYTR_PAYMENT_PROVIDER_ID } from "./checkout"
import { iyzicoCredentialsOf } from "./iyzico"
import { paytrCredentialsOf } from "./paytr"

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
    container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .getSection("payments") as Promise<unknown> as Promise<PaymentSettings>,
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
