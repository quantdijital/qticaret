import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

export interface SecuritySettings {
  /** Whether every staff member must pass 2FA to reach the panel (adr/0040); the owner's switch. */
  staff_mfa_required: boolean
  /** The suspicion score at which an order waits for a person before it ships (adr/0044 §3). */
  fraud_review_score: number
  /** A first order at or above this (kuruş, the whole order) adds to its score. */
  fraud_high_amount: number
  /**
   * Whether the platform's support may open a time-limited session in the
   * panel (adr/0061 Ek "Destek erişimi"): on by default, the owner's switch;
   * turned off, new grants are refused and open sessions end at once.
   */
  support_access_enabled: boolean
}

/**
 * The shop's security (F12.6, F15.6): staff 2FA, on from the start (a
 * member who set it up is asked for it anyway); when an order is held for
 * review. Written by the owner alone.
 */
export const securitySection = defineSection<SecuritySettings>(
  "security",
  {
    staff_mfa_required: z.boolean(),
    fraud_review_score: z.number().int().min(10).max(200),
    fraud_high_amount: z.number().int().min(0).max(1_000_000_000),
    support_access_enabled: z.boolean(),
  },
  {
    staff_mfa_required: true,
    fraud_review_score: 50,
    fraud_high_amount: 500_000,
    support_access_enabled: true,
  }
)
