import { z } from "zod"
import type { AccountSave, NetgsmAccount } from "@/features/settings/api/payments"
import { checkSecrets, nothingStored, typedSecrets } from "@/features/settings/payments"

/**
 * The SMS account's form (adr/0036): Netgsm's user code and password,
 * written once, and the sender name registered to the shop, in the clear.
 */

const SECRETS = ["usercode", "password"] as const
const SECRET = /^[\x21-\x7E]{1,128}$/
// As the server checks it: Netgsm's approved names are short words
const HEADER = /^[0-9A-Za-zÇĞİÖŞÜçğıöşü .-]{2,11}$/

export interface NetgsmFormValues {
  usercode: string
  password: string
  msgheader: string
}

export const netgsmFormValues = (account: NetgsmAccount | undefined): NetgsmFormValues => ({
  usercode: "",
  password: "",
  msgheader: account?.settings?.msgheader ?? "",
})

export function netgsmFormSchema(account: NetgsmAccount | undefined) {
  return z
    .object({
      usercode: z.string(),
      password: z.string(),
      msgheader: z.string().trim().regex(HEADER, "settings.notifications.sms.msgheaderHint"),
    })
    .superRefine((values, ctx) => {
      checkSecrets(values, SECRETS, nothingStored(account), ctx, SECRET)
    })
}

export const netgsmSaveBody = (values: NetgsmFormValues): AccountSave => ({
  settings: { msgheader: values.msgheader.trim() },
  ...typedSecrets({ ...values }, SECRETS),
})
