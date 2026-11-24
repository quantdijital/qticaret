import { useFormContext, useFormState } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { PopupValues } from "@/features/popups/form"

/**
 * A field's error in words: the form's own keys translated, a backend
 * refusal's sentence (already in the panel's language) as it came.
 */
export function useFieldError(): (name: keyof PopupValues) => string | undefined {
  const { t } = useTranslation()
  const { control } = useFormContext<PopupValues>()
  const { errors } = useFormState({ control })
  return (name) => {
    const message = errors[name]?.message
    if (typeof message !== "string" || message === "") {
      return undefined
    }
    return message.startsWith("popups.errors.") ? t(message) : message
  }
}
