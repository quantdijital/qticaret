import { appearanceSection } from "./appearance"
import { bankTransferSection } from "./bank-transfer"
import { cashOnDeliverySection } from "./cash-on-delivery"
import type { SectionDefinition } from "./define"
import { inventorySection } from "./inventory"
import { marketingSection } from "./marketing"
import { notificationsSection } from "./notifications"
import { paymentsSection } from "./payments"
import { promotionsSection } from "./promotions"
import { seoSection } from "./seo"
import { shippingSection } from "./shipping"
import { storeSection } from "./store"

export { DEFAULT_ROBOTS_TXT } from "./seo"
export type { AppearanceSettings } from "./appearance"
export type { BankTransferSettings } from "./bank-transfer"
export type { CashOnDeliverySettings } from "./cash-on-delivery"
export type { InventorySettings } from "./inventory"
export type { MarketingSettings } from "./marketing"
export type { NotificationSettings } from "./notifications"
export type { PaymentSettings } from "./payments"
export type { PromotionSettings } from "./promotions"
export type { SeoSettings } from "./seo"
export type { LabelFormat, ShippingRate, ShippingSettings } from "./shipping"
export type { StoreSettings } from "./store"
export { mergePatch } from "./define"
export type { SectionDefinition } from "./define"

export const SECTIONS = {
  store: storeSection,
  seo: seoSection,
  appearance: appearanceSection,
  inventory: inventorySection,
  promotions: promotionsSection,
  payments: paymentsSection,
  bank_transfer: bankTransferSection,
  cash_on_delivery: cashOnDeliverySection,
  shipping: shippingSection,
  notifications: notificationsSection,
  marketing: marketingSection,
} as const

export type SectionName = keyof typeof SECTIONS

// Own keys only: `in` would also accept "toString" and "__proto__"
export const isSectionName = (value: string): value is SectionName => Object.hasOwn(SECTIONS, value)

export const sectionOf = (name: SectionName): SectionDefinition<Record<string, unknown>> =>
  SECTIONS[name] as unknown as SectionDefinition<Record<string, unknown>>
