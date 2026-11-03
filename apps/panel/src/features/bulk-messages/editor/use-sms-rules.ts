import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { sectionQuery } from "@/features/settings/api/sections"
import type { MarketingSettings } from "@/features/settings/api/sections"
import { useShopTokenValues } from "@/features/settings/api/shop-tokens"
import type { ShopTokenValues } from "@/features/settings/shop-tokens"
import { smsAsSent, smsFooter, smsLength } from "@/features/bulk-messages/sms"
import type { SmsLength } from "@/features/bulk-messages/sms"

export interface SmsRules {
  /** The shop's details and the marketing settings are in. */
  ready: boolean
  values: ShopTokenValues
  /** The fixed end every bulk text gets: the shop's name and the opt-out line. */
  footer: string
  /** Ayarlar > SMS's opt-out line; none: no SMS campaign starts. */
  optOut: string | null
  /** The hours texts go in, Türkiye time. */
  hours: { start: number; end: number } | null
  /** The text as a recipient gets it, and its length; none until ready. */
  measure: (text: string) => { text: string; length: SmsLength } | null
}

/**
 * What the backend adds to a bulk text and counts it with (adr/0050 §4):
 * the shop's name (the store's, "Mağaza" without one) and the opt-out
 * line, the shop's details filled in, `{ad}` as the longest greeting.
 */
export function useSmsRules(enabled = true): SmsRules {
  const { t } = useTranslation()
  const values = useShopTokenValues(enabled)
  const marketing = useQuery({ ...sectionQuery<MarketingSettings>("marketing"), enabled })
  const settings = marketing.data?.values
  const named = values?.["mağaza_adı"]?.trim() ?? ""
  const shopName = named === "" ? t("bulkMessages.sms.shopFallback") : named
  const optOut = settings?.sms_opt_out_text ?? null
  const ready = values !== undefined && settings !== undefined
  return {
    ready,
    values: values ?? {},
    footer: smsFooter(shopName, optOut ?? ""),
    optOut,
    hours: settings
      ? { start: settings.campaign_sms_start_hour, end: settings.campaign_sms_end_hour }
      : null,
    measure: (text) => {
      if (!ready) {
        return null
      }
      const sent = smsAsSent(text, values, shopName, optOut ?? "")
      return { text: sent, length: smsLength(sent) }
    },
  }
}
