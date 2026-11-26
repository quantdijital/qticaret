import { z } from "zod"
import type { AccountSave, PttAccount } from "@/features/settings/api/payments"
import { checkSecrets, nothingStored, typedSecrets } from "@/features/settings/payments"

/**
 * The PTT Kargo page's form (docs/entegrasyonlar/ptt.md): the customer
 * number the Başmüdürlük gives (in the clear, 9 or 10 digits) and the web
 * service password, written once; test mode. Another number or mode is
 * another account: the password again (the server asks the same). The
 * barcode range has its own card (`./components/ptt-barcode-card`).
 */

const SECRETS = ["password"] as const
// Not under 3: shorter could not be masked where PTT quotes it back (the server checks the same)
const SECRET = /^[\x21-\x7E]{3,128}$/
export const PTT_CUSTOMER_ID = /^\d{9,10}$/
/** A range's end: twelve digits, without the check digit. */
export const PTT_SERIAL = /^\d{12}$/

export interface PttFormValues {
  customer_id: string
  password: string
  test_mode: boolean
}

export const pttFormValues = (account: PttAccount | undefined): PttFormValues => ({
  customer_id: account?.settings?.customer_id ?? "",
  password: "",
  // A new connection starts in test mode
  test_mode: account?.settings?.test_mode ?? true,
})

/** The password is asked again: nothing usable is stored, or the account itself changes. */
export function pttPasswordRequired(
  account: PttAccount | undefined,
  values: Pick<PttFormValues, "customer_id" | "test_mode">
): boolean {
  const stored = account?.settings
  return (
    nothingStored(account) ||
    (stored?.customer_id ?? "") !== values.customer_id.trim() ||
    stored?.test_mode !== values.test_mode
  )
}

export function pttFormSchema(account: PttAccount | undefined) {
  return z
    .object({
      customer_id: z
        .string()
        .trim()
        .regex(PTT_CUSTOMER_ID, "settings.shipping.ptt.customerIdInvalid"),
      password: z.string(),
      test_mode: z.boolean(),
    })
    .superRefine((values, ctx) => {
      checkSecrets(values, SECRETS, pttPasswordRequired(account, values), ctx, SECRET)
    })
}

export const pttSaveBody = (values: PttFormValues): AccountSave => ({
  settings: { customer_id: values.customer_id.trim(), test_mode: values.test_mode },
  ...typedSecrets({ ...values }, SECRETS),
})

/** A new range's form: both ends of twelve digits, the last not below the first. */
export const pttRangeSchema = z
  .object({
    first: z.string().trim().regex(PTT_SERIAL, "settings.shipping.ptt.ranges.invalid"),
    last: z.string().trim().regex(PTT_SERIAL, "settings.shipping.ptt.ranges.invalid"),
  })
  .refine((values) => Number(values.last) >= Number(values.first), {
    message: "settings.shipping.ptt.ranges.reversed",
    path: ["last"],
  })

export type PttRangeValues = z.infer<typeof pttRangeSchema>
