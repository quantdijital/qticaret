import { z } from "zod"
import type { AccountSave, GeliverAccount } from "@/features/settings/api/payments"
import { checkSecrets, nothingStored, typedSecrets } from "@/features/settings/payments"

/** The Geliver page's form (F7, adr/0031): the API token, written once, and test shipments. */

const GELIVER_SECRETS = ["api_token"] as const
// Geliver's tokens are longer than a payment key (the server checks the same)
const TOKEN = /^[\x21-\x7E]{16,2048}$/

export interface GeliverFormValues {
  api_token: string
  test_mode: boolean
}

export const geliverFormValues = (account: GeliverAccount | undefined): GeliverFormValues => ({
  api_token: "",
  // A new connection starts with test shipments
  test_mode: account?.settings?.test_mode ?? true,
})

/** One token for both modes: asked for only while none is stored. */
export function geliverFormSchema(account: GeliverAccount | undefined) {
  return z.object({ api_token: z.string(), test_mode: z.boolean() }).superRefine((values, ctx) => {
    checkSecrets(values, GELIVER_SECRETS, nothingStored(account), ctx, TOKEN)
  })
}

export const geliverSaveBody = (values: GeliverFormValues): AccountSave => ({
  settings: { test_mode: values.test_mode },
  ...typedSecrets({ ...values }, GELIVER_SECRETS),
})
