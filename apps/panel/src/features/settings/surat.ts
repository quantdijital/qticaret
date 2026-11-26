import { z } from "zod"
import type { AccountSave, SuratAccount } from "@/features/settings/api/payments"
import { checkSecrets, nothingStored, typedSecrets } from "@/features/settings/payments"

/**
 * The Sürat Kargo page's form (docs/entegrasyonlar/surat.md): the web
 * service login that opens parcels, written once; the cari kodu and web
 * password that track, label and delete them, when Sürat gave a second
 * pair (both parts or neither; without it the first pair does all). Sürat
 * has no test service: no mode.
 */

const MAIN = ["username", "password"] as const
const CARI = ["cari_code", "web_password"] as const
// What Sürat gives may be short (the server checks the same)
const SECRET = /^[\x21-\x7E]{1,128}$/

export interface SuratFormValues {
  username: string
  password: string
  cari_code: string
  web_password: string
}

export const suratFormValues = (): SuratFormValues => ({
  username: "",
  password: "",
  cari_code: "",
  web_password: "",
})

/** The login is asked again: nothing usable is stored. */
export const suratLoginRequired = (account: SuratAccount | undefined): boolean =>
  nothingStored(account)

/** Whether the cari pair is stored and stays. */
export const cariKept = (account: SuratAccount | undefined): boolean =>
  account?.secrets["cari_code"] === true && !suratLoginRequired(account)

export function suratFormSchema(account: SuratAccount | undefined) {
  return z
    .object({
      username: z.string(),
      password: z.string(),
      cari_code: z.string(),
      web_password: z.string(),
    })
    .superRefine((values, ctx) => {
      checkSecrets(values, MAIN, suratLoginRequired(account), ctx, SECRET)
      // One part of the cari pair typed asks for the other, unless it is stored and stays
      const typed = CARI.some((name) => values[name].trim() !== "")
      checkSecrets(values, CARI, typed && !cariKept(account), ctx, SECRET)
    })
}

export const suratSaveBody = (values: SuratFormValues): AccountSave => ({
  settings: {},
  ...typedSecrets({ ...values }, [...MAIN, ...CARI]),
})
