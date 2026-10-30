import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

/**
 * Who the shop sells restricted products to (F13.3, adr/0041 §4): the
 * lowest age a buyer of one declares. The law's limit is 18 for most such
 * goods; a shop may ask more.
 */
export interface ComplianceSettings {
  min_age: number
}

export const DEFAULT_MIN_AGE = 18

export const complianceSection = defineSection<ComplianceSettings>(
  "compliance",
  {
    min_age: z
      .number()
      .int()
      .min(DEFAULT_MIN_AGE, { message: "platform_settings.min_age_invalid" })
      .max(25, { message: "platform_settings.min_age_invalid" }),
  },
  { min_age: DEFAULT_MIN_AGE }
)
