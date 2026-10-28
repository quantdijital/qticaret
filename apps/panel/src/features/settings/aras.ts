import { z } from "zod"
import type { AccountSave, ArasAccount } from "@/features/settings/api/payments"
import { checkSecrets, nothingStored, typedSecrets } from "@/features/settings/payments"

/**
 * The Aras Kargo page's form (adr/0035): the user name and password,
 * written once; the customer code and the service address in the clear;
 * test mode. A new customer code is another account: both secrets again.
 */

const ARAS_SECRETS = ["username", "password"] as const
// What Aras gives may be short (the server checks the same)
const SECRET = /^[\x21-\x7E]{1,128}$/
const SERVICE_URL = /^https:\/\/([a-z0-9-]+\.)*araskargo\.com\.tr(\/.*)?$/i

export interface ArasFormValues {
  username: string
  password: string
  customer_code: string
  service_url: string
  test_mode: boolean
}

export const arasFormValues = (account: ArasAccount | undefined): ArasFormValues => ({
  username: "",
  password: "",
  customer_code: account?.settings?.customer_code ?? "",
  service_url: account?.settings?.service_url ?? "",
  // A new connection starts in test mode
  test_mode: account?.settings?.test_mode ?? true,
})

const secretsRequired = (account: ArasAccount | undefined, customerCode: string): boolean =>
  nothingStored(account) || (account?.settings?.customer_code ?? "") !== customerCode.trim()

export function arasFormSchema(account: ArasAccount | undefined) {
  return z
    .object({
      username: z.string(),
      password: z.string(),
      customer_code: z
        .string()
        .trim()
        .regex(/^[0-9A-Za-z]{0,20}$/, "settings.shipping.aras.customerCodeHint"),
      service_url: z
        .string()
        .trim()
        .refine(
          (value) => value === "" || SERVICE_URL.test(value),
          "settings.shipping.aras.serviceUrlInvalid"
        ),
      test_mode: z.boolean(),
    })
    .superRefine((values, ctx) => {
      checkSecrets(
        values,
        ARAS_SECRETS,
        secretsRequired(account, values.customer_code),
        ctx,
        SECRET
      )
    })
}

export const arasSaveBody = (values: ArasFormValues): AccountSave => ({
  settings: {
    test_mode: values.test_mode,
    customer_code: values.customer_code.trim(),
    service_url: values.service_url.trim(),
  },
  ...typedSecrets({ ...values }, ARAS_SECRETS),
})
