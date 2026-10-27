import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type {
  BankTransferSettings,
  CashOnDeliverySettings,
  PaymentSettings,
} from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type Resolver = Pick<MedusaContainer, "resolve">

const sectionOf = async <T>(
  container: Resolver,
  name: "payments" | "bank_transfer" | "cash_on_delivery"
): Promise<T> =>
  (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection(name)) as unknown as T

/** The shop's payment choices (F5 V6, V10), for every card provider. */
export const paymentSettings = (container: Resolver) =>
  sectionOf<PaymentSettings>(container, "payments")

/** The shop's bank account for transfers (F6, adr/0029). */
export const bankTransferSettings = (container: Resolver) =>
  sectionOf<BankTransferSettings>(container, "bank_transfer")

/** Cash on delivery's fee, limit and couriers (F6, adr/0029). */
export const cashOnDeliverySettings = (container: Resolver) =>
  sectionOf<CashOnDeliverySettings>(container, "cash_on_delivery")
