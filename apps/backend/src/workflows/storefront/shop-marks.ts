import type { MedusaContainer } from "@medusajs/framework/types"
import { connectedCardProviders } from "../../lib/payments/card-providers"
import { bankTransferSettings } from "../../lib/payments/settings"
import { arasCredentialsOf } from "../../lib/shipping/aras/credentials"
import { isSuspended } from "../../lib/integrations/suspended"
import { dhlEcomCredentialsOf } from "../../lib/shipping/dhlecommerce/credentials"
import { pttCredentialsOf } from "../../lib/shipping/ptt/credentials"
import { suratCredentialsOf } from "../../lib/shipping/surat/credentials"
import { yurticiCredentialsOf } from "../../lib/shipping/yurtici/credentials"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { CASH_ON_DELIVERY } from "../../modules/platform-settings/features"
import type { CashOnDeliverySettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/**
 * The ways to pay the footer may name (adr/0046 Ek 2026-11-04): the card
 * networks the connected card providers take (both PayTR and iyzico take
 * Visa, Mastercard and Troy), the provider itself, a bank transfer, cash
 * at the door. Keys; the storefront writes their names.
 */
export type PaymentMark =
  "visa" | "mastercard" | "troy" | "paytr" | "iyzico" | "bank_transfer" | "cash_on_delivery"

/** The carriers whose contract the shop connected. */
export type CarrierMark = "aras" | "yurtici" | "dhlecommerce" | "surat" | "ptt"

export interface ShopMarks {
  payments: PaymentMark[]
  carriers: CarrierMark[]
}

const CARD_NETWORKS: readonly PaymentMark[] = ["visa", "mastercard", "troy"]

/**
 * What the shop offers now, as marks for the storefront's footer: derived
 * from its stored provider accounts and payment settings, never typed in,
 * so the footer never promises a way to pay the checkout does not offer.
 */
export async function shopMarks(container: MedusaContainer): Promise<ShopMarks> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const accounts = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  const [cards, bank, codOn, cod, aras, yurtici, dhlecommerce, surat, ptt] = await Promise.all([
    connectedCardProviders(container),
    bankTransferSettings(container),
    settings.isFeatureEnabled(CASH_ON_DELIVERY),
    settings.getSection("cash_on_delivery") as unknown as Promise<CashOnDeliverySettings>,
    accounts.read("aras"),
    accounts.read("yurtici"),
    accounts.read("dhlecommerce"),
    accounts.read("surat"),
    accounts.read("ptt"),
  ])
  const payments: PaymentMark[] = [
    ...(cards.length > 0 ? CARD_NETWORKS : []),
    ...cards,
    ...(bank.enabled && bank.iban ? (["bank_transfer"] as const) : []),
    // Offered only with a courier that collects at the door
    ...(codOn && cod.shipping_option_ids.length > 0 ? (["cash_on_delivery"] as const) : []),
  ]
  const carriers: CarrierMark[] = [
    ...(arasCredentialsOf(aras) ? (["aras"] as const) : []),
    ...(yurticiCredentialsOf(yurtici) ? (["yurtici"] as const) : []),
    ...(dhlEcomCredentialsOf(dhlecommerce) ? (["dhlecommerce"] as const) : []),
    ...(suratCredentialsOf(surat) ? (["surat"] as const) : []),
    ...(pttCredentialsOf(ptt) ? (["ptt"] as const) : []),
    // A carrier suspended on this server ships nothing (`lib/integrations/suspended.ts`)
  ].filter((carrier) => !isSuspended(carrier))
  return { payments, carriers }
}
