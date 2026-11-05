import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, QueryContext } from "@medusajs/framework/utils"
import { fromMedusaAmount } from "../../lib/money"
import type { Kurus, MedusaAmount } from "../../lib/money"
import { installmentLimit, installmentTable } from "../../lib/payments/installments"
import type { InstallmentFamily } from "../../lib/payments/installments"
import { routedCardProviders } from "../../lib/payments/card-providers"
import { paymentSettings } from "../../lib/payments/settings"
import { iyzicoApi, iyzicoCredentialsOf, iyzicoInstallmentTable } from "../../lib/payments/iyzico"
import { paytrCredentialsOf, paytrInstallmentRates } from "../../lib/payments/paytr"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { priceDisplays } from "../pricing/price-display"

export type InstallmentsFor = { cart_id: string } | { variant_id: string; region_id: string }

export interface Installments {
  enabled: boolean
  amount: Kurus
  currency_code: string
  max_count: number
  families: InstallmentFamily[]
}

const notFound = () => new MedusaError(MedusaError.Types.NOT_FOUND, "payments.installments_unknown")

/**
 * What is to be paid, worked out on the server: a cart's total, or a
 * variant's price now as its page shows it (the price display's).
 */
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
  // The price the page shows: an automatic promotion every shopper gets is the price (adr/0023 Ek 2026-11-05)
  const shown = (await priceDisplays(container, [target.variant_id], currency)).get(
    target.variant_id
  )
  return {
    amount: shown?.current ?? fromMedusaAmount(price, { allowRounding: true }),
    currency_code: currency,
  }
}

/**
 * The installment table a storefront shows on a product page or at the
 * cart (F5 V6, V10): the shop's choice, priced by the card provider it
 * offers first (PayTR's rates, or iyzico's totals), the amount from the
 * server. Off, or without a card provider, it is one payment.
 */
export async function installmentsFor(
  container: MedusaContainer,
  target: InstallmentsFor,
  salesChannelIds: readonly string[]
): Promise<Installments> {
  const { amount, currency_code } = await amountOf(container, target, salesChannelIds)
  const settings = await paymentSettings(container)
  // The provider the storefront tries first prices the table (F6.3: a healthy one)
  const provider = (await routedCardProviders(container))[0]?.provider
  const off = { enabled: false, amount, currency_code, max_count: 1, families: [] }
  if (!settings.installments_enabled || !provider || currency_code !== "try") {
    return off
  }
  const accounts = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  let limit: number
  let families: InstallmentFamily[]
  if (provider === "iyzico") {
    const account = iyzicoCredentialsOf(await accounts.read("iyzico"))
    if (!account) {
      return off
    }
    // A checkout form offers at most 12
    limit = installmentLimit(settings.max_installment, 12)
    families = iyzicoInstallmentTable(
      amount,
      await iyzicoApi().installmentTable(account, amount),
      limit
    )
  } else {
    const account = paytrCredentialsOf(await accounts.read("paytr"))
    if (!account) {
      return off
    }
    const rates = await paytrInstallmentRates(account)
    limit = installmentLimit(settings.max_installment, rates.maxInstallment)
    families = installmentTable(amount, rates.rates, limit)
  }
  return families.length > 0
    ? { enabled: true, amount, currency_code, max_count: limit, families }
    : off
}
