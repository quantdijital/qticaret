import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { emailLinkUrl } from "../../../lib/messaging/links"
import type { StockAlertVars } from "../../../lib/messaging/templates"
import { BACK_IN_STOCK_MODULE } from "../../../modules/back-in-stock"
import type BackInStockModuleService from "../../../modules/back-in-stock/service"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../../catalog/entity-paths"
import { brandOf } from "../brand"
import type { Loaded } from "./types"

type Container = Pick<MedusaContainer, "resolve">

interface VariantRow {
  title: string | null
  product?: { id: string; title: string; variants?: ({ id: string } | null)[] | null } | null
}

/**
 * A stock alert's e-mail (F10.5): its product, the product's storefront
 * page, and for a guest's confirmation the link with the token only the
 * request knew. The address is decrypted here, to send.
 */
export async function loadStockAlert(
  container: Container,
  alertId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<StockAlertVars> | null> {
  const alerts = container.resolve<BackInStockModuleService>(BACK_IN_STOCK_MODULE)
  const [alert] = await alerts.listStockAlerts({ id: alertId }, { take: 1 })
  const email = alert ? await alerts.addressOf(alert.id) : null
  if (!alert || !email) {
    return null
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["title", "product.id", "product.title", "product.variants.id"],
    filters: { id: alert.variant_id },
  })
  const variant = data[0] as VariantRow | undefined
  if (!variant?.product) {
    return null
  }
  const [entry] = await container
    .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    .listUrlEntries(
      {
        locale: CATALOG_LOCALE,
        entity_type: CATALOG_ENTITY_TYPES.product,
        entity_id: variant.product.id,
        status: "active",
      },
      { take: 1, select: ["path"] }
    )
  const { storefrontUrl } = await brandOf(container)
  const token = extra["token"]
  return {
    vars: {
      product: variant.product.title,
      variant: (variant.product.variants?.length ?? 0) > 1 ? variant.title : null,
      productUrl: storefrontUrl && entry ? `${storefrontUrl}${entry.path}` : null,
      // The storefront's page once the shop has a host (adr/0038 Ek 2026-11-02)
      confirmUrl: token ? emailLinkUrl("stock_alert", token, storefrontUrl) : null,
    },
    recipients: { email },
    receiverId: alert.customer_id,
    resourceType: "stock_alert",
  }
}
