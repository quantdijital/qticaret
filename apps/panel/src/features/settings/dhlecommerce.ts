import { z } from "zod"
import type { AccountSave, DhlEcomAccount } from "@/features/settings/api/payments"
import { checkSecrets, nothingStored, typedSecrets } from "@/features/settings/payments"

/**
 * The DHL eCommerce page's form (docs/entegrasyonlar/dhlecommerce.md): the
 * shop's customer number and its "Online Şube" password, written once;
 * test mode. The app keys are the platform's (adr/0027 Ek 2026-11-26)
 * unless the shop registered its own app at DHL's portal: then its keys
 * (`X-IBM-Client-Id`, `X-IBM-Client-Secret`), both or neither, are used
 * in place of the platform's (the owner, 2026-11-26), and needed where the
 * platform has none. Test and live accounts differ: switching asks for
 * them all again.
 */

const KEYS = ["customer_number", "password"] as const
const APP = ["client_id", "client_secret"] as const
// What DHL gives may be short (the server checks the same)
const SECRET = /^[\x21-\x7E]{1,128}$/

export interface DhlEcomFormValues {
  customer_number: string
  password: string
  client_id: string
  client_secret: string
  test_mode: boolean
}

export const dhlEcomFormValues = (account: DhlEcomAccount | undefined): DhlEcomFormValues => ({
  customer_number: "",
  password: "",
  client_id: "",
  client_secret: "",
  // A new connection starts in test mode
  test_mode: account?.settings?.test_mode ?? true,
})

/** Both are asked again: nothing usable is stored, or the mode (so the account) changes. */
export const dhlEcomKeysRequired = (
  account: DhlEcomAccount | undefined,
  testMode: boolean
): boolean => nothingStored(account) || account?.settings?.test_mode !== testMode

/** Whether the shop's own app keys are stored and stay (the account is not asked again). */
export const ownAppKept = (account: DhlEcomAccount | undefined, testMode: boolean): boolean =>
  account?.secrets["client_id"] === true && !dhlEcomKeysRequired(account, testMode)

/**
 * `available`: the platform's app is set on this server. Without it the
 * shop's own app keys are needed; with it, one typed asks for the other.
 */
export function dhlEcomFormSchema(account: DhlEcomAccount | undefined, available = true) {
  return z
    .object({
      customer_number: z.string(),
      password: z.string(),
      client_id: z.string(),
      client_secret: z.string(),
      test_mode: z.boolean(),
    })
    .superRefine((values, ctx) => {
      checkSecrets(values, KEYS, dhlEcomKeysRequired(account, values.test_mode), ctx, SECRET)
      const typed = APP.some((name) => values[name].trim() !== "")
      const kept = ownAppKept(account, values.test_mode)
      checkSecrets(values, APP, (typed || !available) && !kept, ctx, SECRET)
    })
}

export const dhlEcomSaveBody = (values: DhlEcomFormValues): AccountSave => ({
  settings: { test_mode: values.test_mode },
  ...typedSecrets({ ...values }, [...KEYS, ...APP]),
})
