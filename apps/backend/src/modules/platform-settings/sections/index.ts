import { accountingSection } from "./accounting"
import { appearanceSection } from "./appearance"
import { bankTransferSection } from "./bank-transfer"
import { cashOnDeliverySection } from "./cash-on-delivery"
import type { SectionDefinition } from "./define"
import { inventorySection } from "./inventory"
import { invoicingSection } from "./invoicing"
import { legalSection } from "./legal"
import { maintenanceSection } from "./maintenance"
import { marketingSection } from "./marketing"
import { notificationsSection } from "./notifications"
import { paymentLinksSection } from "./payment-links"
import { paymentsSection } from "./payments"
import { promotionsSection } from "./promotions"
import { returnsSection } from "./returns"
import { complianceSection } from "./compliance"
import { securitySection } from "./security"
import { seoSection } from "./seo"
import { shippingSection } from "./shipping"
import { storeSection } from "./store"
import { storefrontSection } from "./storefront"
import { themeSection } from "./theme"

export { DEFAULT_ROBOTS_TXT } from "./seo"
export type { AccountingSettings } from "./accounting"
export type { AppearanceSettings } from "./appearance"
export type { BankTransferSettings } from "./bank-transfer"
export type { CashOnDeliverySettings } from "./cash-on-delivery"
export type { InventorySettings } from "./inventory"
export type { CarrierIdentity, InvoiceCarrier, InvoicingSettings } from "./invoicing"
export type { LegalSettings } from "./legal"
export type { MaintenanceSettings } from "./maintenance"
export type { MarketingSettings } from "./marketing"
export type { NotificationSettings } from "./notifications"
export type { PaymentLinkSettings } from "./payment-links"
export type { PaymentSettings } from "./payments"
export type { PromotionSettings } from "./promotions"
export type { ReturnsSettings } from "./returns"
export type { ComplianceSettings } from "./compliance"
export type { SecuritySettings } from "./security"
export type { SeoSettings } from "./seo"
export type { LabelFormat, ShippingRate, ShippingSettings } from "./shipping"
export type { StoreSettings } from "./store"
export type { StorefrontLink, StorefrontHero, StorefrontSettings, TrustIcon } from "./storefront"
export { TRUST_ICONS } from "./storefront"
export type { ThemeBackground, ThemeSettings } from "./theme"
export { BODY_FONTS, HEADING_FONTS, INSTALLED_THEMES, THEME_BACKGROUNDS } from "./theme"
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
  accounting: accountingSection,
  invoicing: invoicingSection,
  security: securitySection,
  legal: legalSection,
  returns: returnsSection,
  compliance: complianceSection,
  storefront: storefrontSection,
  maintenance: maintenanceSection,
  theme: themeSection,
  payment_links: paymentLinksSection,
} as const

export type SectionName = keyof typeof SECTIONS

// Own keys only: `in` would also accept "toString" and "__proto__"
export const isSectionName = (value: string): value is SectionName => Object.hasOwn(SECTIONS, value)

export const sectionOf = (name: SectionName): SectionDefinition<Record<string, unknown>> =>
  SECTIONS[name] as unknown as SectionDefinition<Record<string, unknown>>
