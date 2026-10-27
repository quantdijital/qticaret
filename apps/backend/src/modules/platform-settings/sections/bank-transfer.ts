import { z } from "@medusajs/framework/zod"
import { isValidTrIban, normalizeIban } from "../../../lib/tr/iban"
import { defineSection, isCleanText } from "./define"

export interface BankTransferSettings {
  /** Whether the storefront offers paying by bank transfer (F6, adr/0029). */
  enabled: boolean
  account_holder: string
  bank_name: string
  /** Stored without spaces; empty until the shop enters it. */
  iban: string
  /** Hours the shopper has to pay; an unpaid order is cancelled after. */
  deadline_hours: number
}

const text = (max: number) =>
  z.string().trim().max(max).refine(isCleanText, "settings.text_invalid")

/** The shop's bank account for transfers: public, shown to every shopper who picks it. */
export const bankTransferSection = defineSection<BankTransferSettings>(
  "bank_transfer",
  {
    enabled: z.boolean(),
    account_holder: text(140),
    bank_name: text(80),
    iban: z
      .string()
      .transform(normalizeIban)
      .refine((value) => value === "" || isValidTrIban(value), "bank_transfer.iban_invalid"),
    deadline_hours: z.number().int().min(1).max(336),
  },
  { enabled: false, account_holder: "", bank_name: "", iban: "", deadline_hours: 48 },
  (values, ctx) => {
    // On only with somewhere to send the money
    if (values.enabled && (!values.iban || !values.account_holder || !values.bank_name)) {
      ctx.addIssue({ code: "custom", path: ["enabled"], message: "bank_transfer.incomplete" })
    }
  }
)
