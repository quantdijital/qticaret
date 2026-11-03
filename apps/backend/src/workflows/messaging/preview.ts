import type { MedusaContainer } from "@medusajs/framework/types"
import { panelUrl } from "../../lib/env"
import { emailLinkUrl } from "../../lib/messaging/links"
import { SAMPLE_ORIGIN, previewVars } from "../../lib/messaging/preview"
import type { PreviewFacts } from "../../lib/messaging/preview"
import type { Brand, EmailContent, MessageTemplate } from "../../lib/messaging/templates"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type {
  BankTransferSettings,
  LegalSettings,
  MarketingSettings,
  SectionName,
  StoreSettings,
} from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { PREVIEW_UNSUBSCRIBE_TOKEN } from "../campaigns/preview"
import { brandOf } from "./brand"

const HOUR = 60 * 60 * 1000

/** What the shop has filled in that a message's preview shows (F9.3), read now. */
export async function previewFactsOf(
  container: Pick<MedusaContainer, "resolve">,
  now: Date = new Date()
): Promise<{ brand: Brand; facts: PreviewFacts }> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const section = <T>(name: SectionName) =>
    settings.getSection(name) as Promise<unknown> as Promise<T>
  const [brand, legal, marketing, bank, store] = await Promise.all([
    brandOf(container),
    section<LegalSettings>("legal"),
    section<MarketingSettings>("marketing"),
    section<BankTransferSettings>("bank_transfer"),
    section<StoreSettings>("store"),
  ])
  // An order placed now waits this long for the money, as the shop has set it
  const deadline = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: store.timezone,
  }).format(new Date(now.getTime() + bank.deadline_hours * HOUR))
  return {
    brand,
    facts: {
      shopName: brand.shopName,
      storefrontUrl: brand.storefrontUrl,
      panelUrl: panelUrl(),
      legal: { company_title: legal.company_title, mersis: legal.mersis },
      // Stored trimmed, a blank one as null (the section's schema)
      smsOptOut: marketing.sms_opt_out_text ?? null,
      bank: {
        holder: bank.account_holder,
        bank: bank.bank_name,
        iban: bank.iban,
        deadline,
      },
    },
  }
}

export interface MessagePreview {
  brand: Brand
  email: EmailContent | null
  sms: string | null
}

/**
 * A message as the shop would send it (F9.3): its made-up sample, the
 * shop's own details and links in place, in its brand. A commercial
 * e-mail's way out is where it would be, with a token no unsubscribe page
 * takes. Nothing is sent.
 */
export async function messagePreview<V>(
  container: Pick<MedusaContainer, "resolve">,
  template: MessageTemplate<V>
): Promise<MessagePreview> {
  const { brand, facts } = await previewFactsOf(container)
  const vars = previewVars(template, facts)
  const unsubscribeUrl =
    template.kind === "commercial"
      ? (emailLinkUrl("unsubscribe", PREVIEW_UNSUBSCRIBE_TOKEN, brand.storefrontUrl) ??
        `${SAMPLE_ORIGIN}/abonelik/cik?t=${PREVIEW_UNSUBSCRIBE_TOKEN}`)
      : null
  return {
    brand,
    email: template.email ? template.email(vars, brand, { unsubscribeUrl }) : null,
    sms: template.sms ? template.sms(vars, brand) : null,
  }
}
