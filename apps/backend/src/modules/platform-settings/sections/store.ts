import { z } from "@medusajs/framework/zod"
import { isHttpsUrl, isStorageUrl } from "../../../lib/security/https-url"
import { isCleanText } from "../../../lib/security/text"
import { openingHours } from "../../../lib/shop/hours"
import type { OpeningRange } from "../../../lib/shop/hours"
import { normalizeTrPhone } from "../../../lib/tr/phone"
import { defineSection } from "./define"

const isTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("tr-TR", { timeZone: value })
    return true
  } catch {
    return false
  }
}

/**
 * The shop's own details beside Medusa's store record (F2.3): how it is
 * reached and its units. With the legal section (address, legal identity)
 * the one source every page, text and e-mail reads them from (adr/0048).
 */
export interface StoreSettings {
  contact_email: string | null
  /** E.164 (`+905321234567`). */
  contact_phone: string | null
  /** The number the WhatsApp buttons open, E.164; none: no button. */
  whatsapp_phone: string | null
  /** When the shop answers; none: not said. */
  opening_hours: OpeningRange[]
  /** The shop's place on a map (Google Maps and the like), https; none: no link. */
  map_url: string | null
  /**
   * The ETBİS registration's QR code (adr/0046 Ek 2026-11-04), an image of
   * the media library by its address, shown in the storefront's footer.
   */
  etbis_qr_url: string | null
  timezone: string
  weight_unit: "g" | "kg"
  dimension_unit: "cm" | "mm"
}

export const storeSection = defineSection<StoreSettings>(
  "store",
  {
    contact_email: z.email({ error: "platform_settings.email_invalid" }).max(254).nullable(),
    contact_phone: z
      .string()
      .max(32)
      .nullable()
      .transform((value, ctx) => {
        if (value === null) {
          return null
        }
        const phone = normalizeTrPhone(value)
        if (!phone) {
          ctx.addIssue({ code: "custom", message: "platform_settings.phone_invalid" })
          return z.NEVER
        }
        return phone
      }),
    whatsapp_phone: z
      .string()
      .max(32)
      .nullable()
      .transform((value, ctx) => {
        if (value === null) {
          return null
        }
        const phone = normalizeTrPhone(value)
        if (!phone) {
          ctx.addIssue({ code: "custom", message: "platform_settings.phone_invalid" })
          return z.NEVER
        }
        return phone
      }),
    opening_hours: openingHours,
    map_url: z
      .string()
      .trim()
      .refine((value) => isCleanText(value) && isHttpsUrl(value), {
        message: "platform_settings.url_invalid",
      })
      .nullable(),
    // Our own storage (http on a developer's machine, https deployed) or a path on this
    // host; never a script-capable source or `//host`
    etbis_qr_url: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (value) =>
          isCleanText(value) &&
          (isStorageUrl(value) || (value.startsWith("/") && !value.startsWith("//"))),
        { message: "platform_settings.url_invalid" }
      )
      .nullable(),
    timezone: z
      .string()
      .max(64)
      .refine(isTimeZone, { message: "platform_settings.timezone_invalid" }),
    weight_unit: z.enum(["g", "kg"]),
    dimension_unit: z.enum(["cm", "mm"]),
  },
  {
    contact_email: null,
    contact_phone: null,
    whatsapp_phone: null,
    opening_hours: [],
    map_url: null,
    etbis_qr_url: null,
    timezone: "Europe/Istanbul",
    weight_unit: "g",
    dimension_unit: "cm",
  }
)
