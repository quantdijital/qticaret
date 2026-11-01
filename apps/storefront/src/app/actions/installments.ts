"use server"

import { formatLira } from "@qticaret/ui"
import type { InstallmentFamilyView } from "@qticaret/ui"
import { z } from "zod"
import { isStoreApiError } from "@/lib/store-api/errors"
import { liraRegion } from "@/lib/store-api/requests"
import { storeGet } from "@/lib/store-api/server"

interface Answer {
  installments: {
    enabled: boolean
    families: {
      family: string
      options: { count: number; total: string; per_installment: string }[]
    }[]
  }
}

/**
 * A variant's installment plans by card family (F5): asked of the payment
 * provider only when the shopper opens the table, never on every view.
 * Null when the shop offers none or the provider does not answer.
 */
export async function installmentsFor(variantId: string): Promise<InstallmentFamilyView[] | null> {
  const parsed = z
    .string()
    .regex(/^variant_[0-9A-Za-z]{10,64}$/)
    .safeParse(variantId)
  if (!parsed.success) {
    return null
  }
  try {
    const { id: region_id } = await liraRegion()
    const { installments } = await storeGet<Answer>("/store/payment/installments", {
      variant_id: parsed.data,
      region_id,
    })
    if (!installments.enabled || installments.families.length === 0) {
      return null
    }
    return installments.families.map((family) => ({
      family: family.family,
      options: family.options.map((option) => ({
        count: option.count,
        perInstallment: formatLira(option.per_installment),
        total: formatLira(option.total),
      })),
    }))
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}
