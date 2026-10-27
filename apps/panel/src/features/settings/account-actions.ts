import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useCheckAccount, useRemoveAccount, useSaveAccount } from "@/features/settings/api/payments"
import type { AccountCheck, AccountSave } from "@/features/settings/api/payments"
import { errorText } from "@/lib/errors"

const A = "settings.payments.account"

// Password managers must not offer to keep or fill these: they are the shop's, not a login
export const NOT_A_LOGIN = {
  autoComplete: "off",
  "data-1p-ignore": "",
  "data-lpignore": "true",
  "data-bwignore": "",
} as const

/** Save, test and disconnect for one provider, with their toasts. */
export function useAccountActions(provider: string, name: string) {
  const { t } = useTranslation()
  const save = useSaveAccount(provider)
  const check = useCheckAccount(provider)
  const remove = useRemoveAccount(provider)
  const [failure, setFailure] = useState<string | null>(null)

  /** A check's outcome: what happened and what to do next, for a save or a test. */
  function announce(answer: AccountCheck | null, source: "save" | "test") {
    if (answer === null || answer === "valid") {
      toast.success(answer === "valid" ? t(`${A}.checks.valid`, { name }) : t("settings.saved"))
    } else if (answer === "merchant_invalid" || answer === "secret_invalid") {
      toast.error(t(`settings.payments.${provider}.checks.${answer}`))
    } else if (answer === "unreachable") {
      toast.warning(
        t(source === "save" ? `${A}.checks.unreachable` : `${A}.checks.unreachableTest`, { name })
      )
    } else {
      toast.error(t(`${A}.checks.${answer}`, { name }))
    }
  }

  // Awaited, not `mutate` callbacks: the page remounts the form once the stored
  // account changes, and a callback of the unmounted form would never run
  async function settle<T>(run: Promise<T>, done: (answer: T) => void) {
    try {
      done(await run)
    } catch (error) {
      toast.error(errorText(t, error))
    }
  }

  return {
    save,
    check,
    remove,
    failure,
    busy: save.isPending || check.isPending || remove.isPending,
    submit: async (body: AccountSave) => {
      setFailure(null)
      try {
        announce((await save.mutateAsync(body)).check, "save")
      } catch (error) {
        setFailure(errorText(t, error))
      }
    },
    test: () =>
      void settle(check.mutateAsync(), (answer) => {
        announce(answer.check, "test")
      }),
    disconnect: () =>
      void settle(remove.mutateAsync(), () => {
        toast.success(t(`${A}.removed`, { name }))
      }),
  }
}

export type AccountActions = ReturnType<typeof useAccountActions>
