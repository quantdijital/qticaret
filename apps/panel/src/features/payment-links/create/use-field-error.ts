import { useTranslation } from "react-i18next"

/** An error key in words; undefined while there is none. */
export function useFieldError() {
  const { t } = useTranslation()
  return (error: { message?: string | undefined } | undefined) =>
    error?.message ? t(error.message) : undefined
}
