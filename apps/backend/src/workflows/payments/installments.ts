import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, QueryContext } from "@medusajs/framework/utils"
import { fromMedusaAmount } from "../../lib/money"
import type { Kurus, MedusaAmount } from "../../lib/money"
import { installmentLimit, installmentTable } from "../../lib/payments/installments"
import type { InstallmentFamily } from "../../lib/payments/installments"
import { paytrCredentialsOf, paytrInstallmentRates } from "../../lib/payments/paytr"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { PaymentSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

export type InstallmentsFor = { cart_id: string } | { variant_id: string; region_id: string }

export interface Installments {
  enabled: boolean
  amount: Kurus
  currency_code: string
  max_count: number
  families: InstallmentFamily[]
}

const notFound = () => new MedusaError(MedusaError.Types.NOT_FOUND, "payments.installments_unknown")

/** What is to be paid, worked out on the server: a cart's total, or a variant's price now. */
async function amountOf(
  container: MedusaContainer,
  target: InstallmentsFor,
  salesChannelIds: readonly string[]
): Promise<{ amount: Kurus; currency_code: string }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  if ("cart_id" in target) {
    const { data } = await query.graph({
      entity: "cart",
      fields: ["sales_channel_id", "currency_code", "total", "raw_total"],
      filters: { id: target.cart_id },
    })
    const cart = data[0] as
      | {
          sales_channel_id?: string | null
          currency_code: string
          raw_total?: MedusaAmount
          total?: MedusaAmount
        }
      | undefined
    if (!cart || !salesChannelIds.includes(cart.sales_channel_id ?? "")) {
      throw notFound()
    }
    return {
      amount: fromMedusaAmount(cart.raw_total ?? cart.total ?? 0, { allowRounding: true }),
      currency_code: cart.currency_code,
    }
  }
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["currency_code"],
    filters: { id: target.region_id },
  })
  const currency = (regions[0] as { currency_code?: string } | undefined)?.currency_code
  if (!currency) {
    throw notFound()
  }
  const { data } = await query.graph({
    entity: "product_variant",
    fields: ["product.status", "product.sales_channels.id", "calculated_price.calculated_amount"],
    filters: { id: target.variant_id },
    context: {
      calculated_price: QueryContext({ region_id: target.region_id, currency_code: currency }),
    },
  })
  const variant = data[0] as
    | {
        product?: {
          status?: string | null
          sales_channels?: ({ id: string } | null)[] | null
        } | null
        calculated_price?: { calculated_amount?: number | null } | null
      }
    | undefined
  const visible =
    variant?.product?.status === "published" &&
    (variant.product.sales_channels ?? []).some(
      (channel) => channel !== null && salesChannelIds.includes(channel.id)
    )
  const price = variant?.calculated_price?.calculated_amount
  if (!visible || price === null || price === undefined) {
    throw notFound()
  }
  return { amount: fromMedusaAmount(price, { allowRounding: true }), currency_code: currency }
}

/**
 * The installment table a storefront shows on a product page or at the
 * cart (F5 V6): the shop's choice, PayTR's rates for the shop's account,
 * and the amount from the server. Off, or without a PayTR account, it is
 * one payment.
 */
export async function installmentsFor(
  container: MedusaContainer,
  target: InstallmentsFor,
  salesChannelIds: readonly string[]
): Promise<Installments> {
  const { amount, currency_code } = await amountOf(container, target, salesChannelIds)
  const settings = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("payments")) as unknown as PaymentSettings
  const account = paytrCredentialsOf(
    await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("paytr")
  )
  const off = { enabled: false, amount, currency_code, max_count: 1, families: [] }
  if (!settings.installments_enabled || !account || currency_code !== "try") {
    return off
  }
  const rates = await paytrInstallmentRates(account)
  const limit = installmentLimit(settings.max_installment, rates.maxInstallment)
  const families = installmentTable(amount, rates.rates, limit)
  return families.length > 0
    ? { enabled: true, amount, currency_code, max_count: limit, families }
    : off
}
