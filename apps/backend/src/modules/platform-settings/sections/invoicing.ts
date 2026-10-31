import { z } from "@medusajs/framework/zod"
import { isValidTckn, isValidVkn } from "../../../lib/tr/tax-id"
import { defineSection, isCleanText } from "./define"

/** Who issues the shop's invoices (adr/0034 §1); `fake` only in development and tests. */
export const INVOICING_PROVIDERS = ["none", "parasut", "external", "fake"] as const
export type InvoicingProvider = (typeof INVOICING_PROVIDERS)[number]

/**
 * When an order is invoiced: once it is placed and paid (the default, the
 * shop's accountant, 2026-10-31) or when its parcel leaves. Cash on
 * delivery is invoiced once delivered either way (adr/0034 addendum).
 */
export const INVOICING_TRIGGERS = ["shipped", "placed"] as const

/** The carriers an e-Arşiv may name: ours (adr/0031, adr/0035) and the shop's own parcels. */
export const INVOICE_CARRIERS = ["geliver", "aras", "yurtici", "manual"] as const
export type InvoiceCarrier = (typeof INVOICE_CARRIERS)[number]

export interface CarrierIdentity {
  title: string
  tax_id: string
}

export interface InvoicingSettings {
  provider: InvoicingProvider
  trigger: (typeof INVOICING_TRIGGERS)[number]
  /**
   * The carriers' registered name and tax id, written on an e-Arşiv for a
   * parcel they took. Entered by the shop (they are on the carrier's own
   * invoice); a parcel whose carrier has none waits for it.
   */
  carriers: Partial<Record<InvoiceCarrier, CarrierIdentity>>
}

const carrier = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((value) => isCleanText(value), { message: "platform_settings.text_invalid" }),
    tax_id: z
      .string()
      .trim()
      .refine((value) => isValidVkn(value) || isValidTckn(value), {
        message: "platform_settings.tax_number_invalid",
      }),
  })
  .strict()

export const invoicingSection = defineSection<InvoicingSettings>(
  "invoicing",
  {
    provider: z.enum(INVOICING_PROVIDERS),
    trigger: z.enum(INVOICING_TRIGGERS),
    carriers: z.partialRecord(z.enum(INVOICE_CARRIERS), carrier),
  },
  { provider: "none", trigger: "placed", carriers: {} }
)
