import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { parseEnv, storefrontOrigin } from "../../lib/env"
import type { Env } from "../../lib/env"
import { namesSvg } from "../../lib/media/svg-use"
import type { Brand } from "../../lib/messaging/templates"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { mailPngOf } from "../platform-settings/steps/brand-images"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type {
  AppearanceSettings,
  SeoSettings,
  StoreSettings,
} from "../../modules/platform-settings/sections"

type BrandEnv = Pick<Env, "NODE_ENV" | "STOREFRONT_ORIGIN">

const shopNameOf = (store: { name?: string } | undefined): string => {
  const name = store?.name?.trim() ?? ""
  return name === "" ? "Mağaza" : name
}

// A developer's machine, where the storefront and Mailpit run beside the
// backend; tests keep the deployed rule, so they check what a live shop does
const isDeveloperMachine = (env: BrandEnv): boolean => env.NODE_ENV === "development"

/**
 * The storefront's address for a message's links: `https://` and the
 * shop's canonical host. A host cannot be `localhost:8000` (it needs a
 * dot, no port), so on a developer's machine with none set the dev
 * storefront stands in (`STOREFRONT_ORIGIN`, else localhost:8000) and
 * Mailpit's mails carry links that open. Deployed: null until a host is set.
 */
export function storefrontUrlOf(
  canonicalHost: string | null | undefined,
  env: BrandEnv = parseEnv()
): string | null {
  if (canonicalHost) {
    return `https://${canonicalHost}`
  }
  return isDeveloperMachine(env) ? storefrontOrigin(env) : null
}

/**
 * The logo a mail client can load: an absolute https address (one under
 * our own host is not absolute). On a developer's machine the local file
 * store serves it over http, which Mailpit loads as well.
 */
export function mailLogoUrl(
  logo: string | null | undefined,
  env: BrandEnv = parseEnv()
): string | null {
  if (logo?.startsWith("https://")) {
    return logo
  }
  return logo?.startsWith("http://") && isDeveloperMachine(env) ? logo : null
}

/**
 * The logo a message shows: mail clients (Gmail, Outlook) draw no SVG, so
 * an SVG logo is sent as the PNG made of it when it was chosen
 * (`steps/brand-images.ts`); without one, none, and the mail shows the
 * shop's name.
 */
export async function mailLogoSource(
  container: Pick<MedusaContainer, "resolve">,
  logo: string | null | undefined
): Promise<string | null> {
  if (!logo) {
    return null
  }
  if (!namesSvg(logo)) {
    return logo
  }
  const [asset] = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets({ url: logo }, { select: ["derivatives"], take: 1 })
  return mailPngOf(asset?.derivatives)?.url ?? null
}

/** The shop's name alone (Medusa's store name, else "Mağaza"): its replies under reviews sign with it. */
export async function shopNameRead(container: Pick<MedusaContainer, "resolve">): Promise<string> {
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity: "store", fields: ["name"], pagination: { take: 1 } })
  return shopNameOf((data as { name?: string }[])[0])
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
  const env = parseEnv()
  return {
    shopName: shopNameOf(stores[0]),
    logoUrl: mailLogoUrl(await mailLogoSource(container, appearance.logo_light_url), env),
    color: appearance.brand_color,
    contactEmail: store.contact_email,
    contactPhone: store.contact_phone,
    storefrontUrl: storefrontUrlOf(seo.canonical_host, env),
  }
}
