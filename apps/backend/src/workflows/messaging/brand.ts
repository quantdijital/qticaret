import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { Brand } from "../../lib/messaging/templates"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type {
  AppearanceSettings,
  SeoSettings,
  StoreSettings,
} from "../../modules/platform-settings/sections"

const shopNameOf = (store: { name?: string } | undefined): string => {
  const name = store?.name?.trim() ?? ""
  return name === "" ? "Mağaza" : name
}

/** The shop as its messages present it (adr/0036), read when a message is sent. */
export async function brandOf(container: Pick<MedusaContainer, "resolve">): Promise<Brand> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [appearance, store, seo, { data: stores }] = await Promise.all([
    settings.getSection("appearance") as Promise<unknown> as Promise<AppearanceSettings>,
    settings.getSection("store") as Promise<unknown> as Promise<StoreSettings>,
    settings.getSection("seo") as Promise<unknown> as Promise<SeoSettings>,
    container
      .resolve(ContainerRegistrationKeys.QUERY)
      .graph({ entity: "store", fields: ["name"], pagination: { take: 1 } }),
  ])
  const logo = appearance.logo_light_url
  return {
    shopName: shopNameOf(stores[0]),
    // A mail client needs an absolute address; a logo under our own host is not one
    logoUrl: logo?.startsWith("https://") ? logo : null,
    color: appearance.brand_color,
    contactEmail: store.contact_email,
    contactPhone: store.contact_phone,
    storefrontUrl: seo.canonical_host ? `https://${seo.canonical_host}` : null,
  }
}
