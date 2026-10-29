import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

export interface SecuritySettings {
  /** Whether every staff member must pass 2FA to reach the panel (adr/0040); the owner's switch. */
  staff_mfa_required: boolean
}

/** The shop's staff security (F12.6): on from the start; a member who set 2FA up is asked for it anyway. */
export const securitySection = defineSection<SecuritySettings>(
  "security",
  { staff_mfa_required: z.boolean() },
  { staff_mfa_required: true }
)
