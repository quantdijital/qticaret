import { z } from "zod"
import type { AccountSave, NetgsmAccount } from "@/features/settings/api/payments"
import { checkSecrets, nothingStored, typedSecrets } from "@/features/settings/payments"

/**
 * The SMS account's form (adr/0036): Netgsm's user code and password,
 * written once, the sender name registered to the shop, in the clear, and
 * the shop's İYS brand code, which consents reach İYS under (F10 M11).
 */

const SECRETS = ["usercode", "password"] as const
const SECRET = /^[\x21-\x7E]{1,128}$/
// As the server checks it: Netgsm's approved names are short words
const HEADER = /^[0-9A-Za-zÇĞİÖŞÜçğıöşü .-]{2,11}$/
// İYS gives each brand a number
const BRAND_CODE = /^\d{1,12}$/

export interface NetgsmFormValues {
  usercode: string
  password: string
  msgheader: string
  iysBrandCode: string
}

export const netgsmFormValues = (account: NetgsmAccount | undefined): NetgsmFormValues => ({
  usercode: "",
  password: "",
  msgheader: account?.settings?.msgheader ?? "",
  iysBrandCode: account?.settings?.iys_brand_code ?? "",
})

export function netgsmFormSchema(account: NetgsmAccount | undefined) {
  return z
    .object({
      usercode: z.string(),
      password: z.string(),
      msgheader: z.string().trim().regex(HEADER, "settings.sms.netgsm.msgheaderHint"),
      iysBrandCode: z
        .string()
        .trim()
        .refine(
          (code) => code === "" || BRAND_CODE.test(code),
          "settings.sms.netgsm.iysBrandCodeHint"
        ),
    })
    .superRefine((values, ctx) => {
      checkSecrets(values, SECRETS, nothingStored(account), ctx, SECRET)
    })
}

export const netgsmSaveBody = (values: NetgsmFormValues): AccountSave => ({
  settings: {
    msgheader: values.msgheader.trim(),
    ...(values.iysBrandCode.trim() ? { iys_brand_code: values.iysBrandCode.trim() } : {}),
  },
  ...typedSecrets({ ...values }, SECRETS),
})
