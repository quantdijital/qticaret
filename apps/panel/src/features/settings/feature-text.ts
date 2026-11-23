import { useTranslation } from "react-i18next"

/** A flag's words: its name, a one-line summary and the full description behind the (i). */
export function useFeatureText() {
  const { t } = useTranslation()
  return (key: string) => {
    const base = `settings.features.flags.${key}`
    const description = t(`${base}.description`, { defaultValue: "" })
    return {
      label: t(`${base}.label`, { defaultValue: key }),
      summary: t(`${base}.summary`, { defaultValue: description }),
      description,
    }
  }
}
