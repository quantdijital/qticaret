import { z } from "@medusajs/framework/zod"
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

export interface StoreSettings {
  contact_email: string | null
  /** E.164 (`+905321234567`). */
  contact_phone: string | null
  timezone: string
  weight_unit: "g" | "kg"
  dimension_unit: "cm" | "mm"
}

/** Store details Medusa's store record lacks (F2.3); legal details come with F13 (`legal_info`). */
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
    timezone: "Europe/Istanbul",
    weight_unit: "g",
    dimension_unit: "cm",
  }
)
