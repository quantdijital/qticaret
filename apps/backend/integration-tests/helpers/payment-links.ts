import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { PAYMENT_LINKS_MODULE } from "../../src/modules/payment-links"
import type PaymentLinksModuleService from "../../src/modules/payment-links/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { ensureLocationCarriers } from "../../src/scripts/bootstrap/location-carriers"
import type { HttpClient } from "./http"
import { settle } from "./http"
import { PAYTR_ADDRESS } from "./paytr"
import type { StockShop } from "./stock"

/** adr/0051: a shop that makes payment links, and what a test sends to make one. */

export const GUEST = {
  first_name: "Ayşe",
  last_name: "Yılmaz",
  email: "ayse.yilmaz@example.com",
  phone: "0532 123 45 67",
}

export interface LinkAnswer {
  payment_link?: {
    id: string
    number: string
    status: string
    items_total: number
    discount_total: number
    total: number
    discount: { amount: number } | null
  }
  share?: { url: string | null; sms_text: string | null; whatsapp_url: string | null }
  message?: string
}

/** The shop's storefront host (links open on it) and the flag on. */
export async function linkShop(
  http: HttpClient,
  container: MedusaContainer,
  headers: Record<string, string>
): Promise<void> {
  await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
  await linkFlag(http, headers, true)
}

export const linkFlag = (http: HttpClient, headers: Record<string, string>, enabled: boolean) =>
  settle(http.post("/admin/features/orders.payment_links", { enabled }, { headers }))

/** The `payment_links` section as it starts; a test that changes it puts this back. */
export const LINK_DEFAULTS = { admin_max_discount_percent: 20, allow_cod: false }

export const linkSettings = (
  http: HttpClient,
  headers: Record<string, string>,
  values: Record<string, unknown>
) =>
  settle(
    http.post<{ message?: string }>("/admin/platform-settings/payment_links", values, { headers })
  )

/** A link body: two units of the variant for the guest, preset to the seed's shipping. */
export const linkBody = (
  shop: StockShop,
  variantId: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> => ({
  guest: GUEST,
  lines: [{ variant_id: variantId, quantity: 2 }],
  address: {
    first_name: PAYTR_ADDRESS.first_name,
    last_name: PAYTR_ADDRESS.last_name,
    phone: PAYTR_ADDRESS.phone,
    address_1: PAYTR_ADDRESS.address_1,
    city: PAYTR_ADDRESS.city,
    province: PAYTR_ADDRESS.province,
    postal_code: PAYTR_ADDRESS.postal_code,
  },
  shipping_option_id: shop.shippingOptionId,
  ...extra,
})

export const makeLink = (
  http: HttpClient,
  headers: Record<string, string>,
  body: Record<string, unknown>
) => settle(http.post<LinkAnswer>("/admin/payment-links", body, { headers }))

/** The token of a link's share address. */
export const tokenOf = (url: string | null | undefined): string =>
  decodeURIComponent((url ?? "").split("/ode/")[1] ?? "")

export const linksOf = (container: MedusaContainer) =>
  container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)

export async function linkRow(container: MedusaContainer, id: string) {
  const [row] = await linksOf(container).listPaymentLinks({ id }, { take: 1 })
  if (!row) {
    throw new Error(`no payment link ${id}`)
  }
  return row
}

/** Gives a staff member a name, as their profile would. */
export const nameStaff = (
  container: MedusaContainer,
  id: string,
  firstName: string,
  lastName: string
) => container.resolve(Modules.USER).updateUsers({ id, first_name: firstName, last_name: lastName })

/**
 * A carrier-priced (`calculated`) option in the seed's zone, as the
 * Geliver shop helper makes one: its price comes from the carrier for a cart.
 */
export async function carrierOption(container: MedusaContainer, shop: StockShop): Promise<string> {
  await ensureLocationCarriers(container)
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "shipping_option",
    fields: ["service_zone_id"],
    filters: { id: shop.shippingOptionId },
  })
  const { result } = await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Geliver",
        price_type: "calculated",
        provider_id: "geliver_geliver",
        service_zone_id: (data[0] as { service_zone_id: string }).service_zone_id,
        shipping_profile_id: shop.shippingProfileId,
        data: { id: "geliver-cheapest" },
        type: { label: "Geliver", description: "Geliver", code: "geliver" },
        rules: [
          { attribute: "enabled_in_store", operator: "eq", value: "true" },
          { attribute: "is_return", operator: "eq", value: "false" },
        ],
      },
    ],
  })
  return result[0]?.id ?? ""
}
