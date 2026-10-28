import { z } from "zod"
import type { AccountSave, YurticiAccount } from "@/features/settings/api/payments"
import { checkSecrets, nothingStored, typedSecrets } from "@/features/settings/payments"

/**
 * The Yurtiçi Kargo page's form (adr/0035): the web service login,
 * written once; Yurtiçi's separate login for parcels paid at the door,
 * which the shop may not have, both its parts or neither; test mode. Test
 * and live logins differ: switching asks for them again.
 */

const MAIN = ["username", "password"] as const
const DOOR = ["cod_username", "cod_password"] as const
// What Yurtiçi gives may be short (the server checks the same)
const SECRET = /^[\x21-\x7E]{1,128}$/

export interface YurticiFormValues {
  username: string
  password: string
  cod_username: string
  cod_password: string
  test_mode: boolean
}

export const yurticiFormValues = (account: YurticiAccount | undefined): YurticiFormValues => ({
  username: "",
  password: "",
  cod_username: "",
  cod_password: "",
  // A new connection starts in test mode
  test_mode: account?.settings?.test_mode ?? true,
})

/** The logins are asked again: nothing usable is stored, or the mode (so the account) changes. */
export const yurticiLoginsRequired = (
  account: YurticiAccount | undefined,
  testMode: boolean
): boolean => nothingStored(account) || account?.settings?.test_mode !== testMode

/** Whether the door account is stored and stays (the logins are not asked again). */
export const doorKept = (account: YurticiAccount | undefined, testMode: boolean): boolean =>
  account?.secrets["cod_username"] === true && !yurticiLoginsRequired(account, testMode)

export function yurticiFormSchema(account: YurticiAccount | undefined) {
  return z
    .object({
      username: z.string(),
      password: z.string(),
      cod_username: z.string(),
      cod_password: z.string(),
      test_mode: z.boolean(),
    })
    .superRefine((values, ctx) => {
      checkSecrets(values, MAIN, yurticiLoginsRequired(account, values.test_mode), ctx, SECRET)
      // One part of the door account typed asks for the other, unless it is stored and stays
      const typed = DOOR.some((name) => values[name].trim() !== "")
      checkSecrets(values, DOOR, typed && !doorKept(account, values.test_mode), ctx, SECRET)
    })
}

export const yurticiSaveBody = (values: YurticiFormValues): AccountSave => ({
  settings: { test_mode: values.test_mode },
  ...typedSecrets({ ...values }, [...MAIN, ...DOOR]),
})
