import { z } from "zod"
import type { AccountSave, DhlEcomAccount } from "@/features/settings/api/payments"
import { checkSecrets, nothingStored, typedSecrets } from "@/features/settings/payments"

/**
 * The DHL eCommerce page's form (docs/entegrasyonlar/dhlecommerce.md): the
 * shop's customer number and its "Online Şube" password, written once;
 * test mode. The app keys are the platform's, never asked here (adr/0027
 * Ek 2026-11-26). Test and live accounts differ: switching asks for both
 * again.
 */

const KEYS = ["customer_number", "password"] as const
// What DHL gives may be short (the server checks the same)
const SECRET = /^[\x21-\x7E]{1,128}$/

export interface DhlEcomFormValues {
  customer_number: string
  password: string
  test_mode: boolean
}

export const dhlEcomFormValues = (account: DhlEcomAccount | undefined): DhlEcomFormValues => ({
  customer_number: "",
  password: "",
  // A new connection starts in test mode
  test_mode: account?.settings?.test_mode ?? true,
})

/** Both are asked again: nothing usable is stored, or the mode (so the account) changes. */
export const dhlEcomKeysRequired = (
  account: DhlEcomAccount | undefined,
  testMode: boolean
): boolean => nothingStored(account) || account?.settings?.test_mode !== testMode

export function dhlEcomFormSchema(account: DhlEcomAccount | undefined) {
  return z
    .object({ customer_number: z.string(), password: z.string(), test_mode: z.boolean() })
    .superRefine((values, ctx) => {
      checkSecrets(values, KEYS, dhlEcomKeysRequired(account, values.test_mode), ctx, SECRET)
    })
}

export const dhlEcomSaveBody = (values: DhlEcomFormValues): AccountSave => ({
  settings: { test_mode: values.test_mode },
  ...typedSecrets({ ...values }, [...KEYS]),
})
