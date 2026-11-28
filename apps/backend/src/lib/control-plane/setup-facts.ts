import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { UsageSetup } from "@qticaret/types/control-plane"
import { REQUIRED_KINDS } from "../legal/tokens"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import type { CredentialProviderName } from "../../modules/integration-credentials/providers"
import { LEGAL_MODULE } from "../../modules/legal"
import type LegalModuleService from "../../modules/legal/service"
import { STOREFRONT_LAYOUT_MODULE } from "../../modules/storefront-layout"
import type StorefrontLayoutModuleService from "../../modules/storefront-layout/service"

/**
 * The shop's setup checklist as the usage report carries it (adr/0061 Ek
 * C21): yes/no only. The same steps and rules as the shop panel's setup
 * list (`apps/panel/src/features/dashboard/setup-steps.ts`, docs/17; keep
 * the two together), plus the look, the legal texts and the e-mail
 * sender. Each read is one row or one count; no person, provider name,
 * account or setting leaves here.
 */

type Resolver = Pick<MedusaContainer, "resolve">

/** The name Medusa's store model starts with (the panel's `DEFAULT_STORE_NAME`). */
const DEFAULT_STORE_NAME = "Medusa Store"
/** Card providers: the panel's payment step. */
const PAYMENT_PROVIDERS: readonly CredentialProviderName[] = ["paytr", "iyzico"]
/** Saved and checked, or saved while the provider could not be reached (the panel's rule). */
const USABLE = new Set(["connected", "unverified"])

export interface SetupReads {
  storeName: string | null
  hasDefaultCurrency: boolean
  regions: number
  locations: number
  shippingOptions: number
  paymentConnected: boolean
  publishedProducts: number
  lookPublished: boolean
  /** The legal kinds with a published version. */
  publishedLegalKinds: readonly string[]
  mailSender: boolean
}

/** The facts from what was read: pure, the rules unit-tested on their own. */
export function setupFactsOf(reads: SetupReads): UsageSetup {
  const name = reads.storeName?.trim() ?? ""
  return {
    store_named: name !== "" && name !== DEFAULT_STORE_NAME,
    currency: reads.hasDefaultCurrency,
    region: reads.regions > 0,
    stock_location: reads.locations > 0,
    shipping: reads.shippingOptions > 0,
    payment: reads.paymentConnected,
    product_published: reads.publishedProducts > 0,
    look_published: reads.lookPublished,
    legal_published: REQUIRED_KINDS.every((kind) => reads.publishedLegalKinds.includes(kind)),
    mail_sender: reads.mailSender,
  }
}

const ONE = { select: ["id"], take: 1 }

async function usable(
  service: IntegrationCredentialsModuleService,
  providers: readonly CredentialProviderName[]
): Promise<boolean> {
  const states = await Promise.all(providers.map((provider) => service.describe(provider)))
  return states.some((status) => USABLE.has(status.state))
}

export async function readSetupFacts(container: Resolver): Promise<UsageSetup> {
  const credentials = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  const [store, regions, locations, shipping, payment, products, layouts, legal, email] =
    await Promise.all([
      container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "store",
          fields: ["name", "supported_currencies.is_default"],
          pagination: { skip: 0, take: 1 },
        })
        .then(
          (answer) =>
            answer.data[0] as
              | { name?: string | null; supported_currencies?: { is_default?: boolean }[] }
              | undefined
        ),
      container
        .resolve(Modules.REGION)
        .listAndCountRegions({}, ONE)
        .then(([, count]) => count),
      container
        .resolve(Modules.STOCK_LOCATION)
        .listAndCountStockLocations({}, ONE)
        .then(([, count]) => count),
      container
        .resolve(Modules.FULFILLMENT)
        .listAndCountShippingOptions({}, ONE)
        .then(([, count]) => count),
      usable(credentials, PAYMENT_PROVIDERS),
      container
        .resolve(Modules.PRODUCT)
        .listAndCountProducts({ status: "published" }, ONE)
        .then(([, count]) => count),
      container
        .resolve<StorefrontLayoutModuleService>(STOREFRONT_LAYOUT_MODULE)
        .listStorefrontLayouts({ published_at: { $ne: null } }, ONE),
      container
        .resolve<LegalModuleService>(LEGAL_MODULE)
        .listLegalDocuments(
          { status: "published", kind: [...REQUIRED_KINDS] },
          { select: ["kind"], take: REQUIRED_KINDS.length }
        ),
      usable(credentials, ["smtp"]),
    ])
  return setupFactsOf({
    storeName: store?.name ?? null,
    hasDefaultCurrency: store?.supported_currencies?.some((each) => each.is_default) ?? false,
    regions,
    locations,
    shippingOptions: shipping,
    paymentConnected: payment,
    publishedProducts: products,
    lookPublished: layouts.length > 0,
    publishedLegalKinds: legal.map((row) => row.kind),
    mailSender: email,
  })
}
