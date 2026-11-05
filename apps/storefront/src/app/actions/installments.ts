"use server"

import type { InstallmentFamilyView } from "@qticaret/ui"
import { z } from "zod"
import { variantInstallments } from "@/lib/store-api/installments"
import { installmentFamilies } from "@/lib/views/installments"

/**
 * A variant's installment plans by card family (F5): asked when the
 * shopper opens the table, never on every view (the line under the price
 * comes with the page). Null when the shop offers none for this price or
 * the provider does not answer.
 */
export async function installmentsFor(variantId: string): Promise<InstallmentFamilyView[] | null> {
  const parsed = z
    .string()
    .regex(/^variant_[0-9A-Za-z]{10,64}$/)
    .safeParse(variantId)
  if (!parsed.success) {
    return null
  }
  const table = await variantInstallments(parsed.data)
  return table ? installmentFamilies(table) : null
}
