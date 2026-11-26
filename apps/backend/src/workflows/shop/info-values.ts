import type { MedusaContainer } from "@medusajs/framework/types"
import type { ShopInfoValues } from "../../lib/shop/tokens"
import { standaloneThreshold } from "../../lib/promotions/free-shipping"
import { displayTrPhone } from "../../lib/tr/phone"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { PromotionSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { shopLegalValues } from "../legal/read"
import { legalIdentity } from "../legal/identity"

type Container = Pick<MedusaContainer, "resolve">

/** Lira as a shopper reads an amount: `₺1.500`, `₺1.499,90`. */
const lira = (amount: number): string =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)

/**
 * What the shop's `{belirteç}`s stand for now (adr/0048): the store
 * details, the legal identity and the free shipping threshold, phones as
 * a Turkish reader writes them. The same names the legal texts use.
 */
export async function shopInfoValues(container: Container): Promise<ShopInfoValues> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [legal, identity, promotions] = await Promise.all([
    shopLegalValues(container),
    legalIdentity(container),
    settings.getSection("promotions") as Promise<unknown> as Promise<PromotionSettings>,
  ])
  const threshold = standaloneThreshold(promotions)
  return {
    mağaza_adı: legal.mağaza_adı,
    telefon: identity.contact_phone ? displayTrPhone(identity.contact_phone) : null,
    e_posta: identity.contact_email,
    adres: identity.address,
    whatsapp: identity.whatsapp_phone ? displayTrPhone(identity.whatsapp_phone) : null,
    ücretsiz_kargo_eşiği: threshold && threshold > 0 ? lira(threshold) : null,
  }
}
