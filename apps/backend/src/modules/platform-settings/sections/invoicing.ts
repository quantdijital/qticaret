import { z } from "@medusajs/framework/zod"
import { isValidTckn, isValidVkn } from "@qticaret/server-kit"
import { defineSection, isCleanText, isPlainObject } from "./define"

/**
 * Who issues the shop's invoices (adr/0034 §1). `birfatura`: BirFatura
 * pulls the orders and writes the invoice back (adr/0072), as an external
 * program does. `fake` can be picked in tests only (`fakeInvoicingAllowed`);
 * it stays here so a value stored earlier still reads, and then issues nothing.
 */
export const INVOICING_PROVIDERS = ["none", "parasut", "external", "fake", "birfatura"] as const
export type InvoicingProvider = (typeof INVOICING_PROVIDERS)[number]

/**
 * When an order is invoiced: once it is placed and paid (the default, the
 * shop's accountant, 2026-10-31) or when its parcel leaves. Cash on
 * delivery is invoiced once delivered either way (adr/0034 addendum).
 */
export const INVOICING_TRIGGERS = ["shipped", "placed"] as const

/** The carriers an e-Arşiv may name: ours (adr/0035) and the shop's own parcels. */
export const INVOICE_CARRIERS = ["aras", "yurtici", "dhlecommerce", "surat", "manual"] as const
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
  /**
   * The series (GİB number's first three characters) the shop's web sales
   * are invoiced in, apart from those it issues by hand elsewhere (the
   * accountant, 2026-10-31). An invoice written back in another is
   * refused; at Paraşüt the series is chosen in its own e-document settings.
   */
  series: string | null
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

/**
 * A stored row's carriers we still ship with (adr/0062 §4): one no longer
 * offered (adr/0031, 2026-11-26 addendum) is dropped, so the others' names
 * and tax ids keep reading instead of the whole field falling back.
 */
function upgrade(stored: Record<string, unknown>): Record<string, unknown> {
  const carriers = stored["carriers"]
  if (!isPlainObject(carriers)) {
    return stored
  }
  const known: readonly string[] = INVOICE_CARRIERS
  const kept = Object.fromEntries(Object.entries(carriers).filter(([key]) => known.includes(key)))
  return Object.keys(kept).length === Object.keys(carriers).length
    ? stored
    : { ...stored, carriers: kept }
}

export const invoicingSection = defineSection<InvoicingSettings>(
  "invoicing",
  {
    provider: z.enum(INVOICING_PROVIDERS),
    trigger: z.enum(INVOICING_TRIGGERS),
    carriers: z.partialRecord(z.enum(INVOICE_CARRIERS), carrier),
    series: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{3}$/, { message: "platform_settings.invoice_series_invalid" })
      .nullable(),
  },
  { provider: "none", trigger: "placed", carriers: {}, series: null },
  undefined,
  upgrade
)
