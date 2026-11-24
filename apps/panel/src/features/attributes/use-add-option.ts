import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { errorText } from "@/lib/errors"
import { useSaveTemplate } from "./api"
import { optionValue, templateForm } from "./form"
import type { AttributeTemplate } from "./types"

/** Adds `label` to the field's values; resolves to the new value, or null when it was not saved. */
export type AddOption = (key: string, label: string) => Promise<string | null>

/**
 * A missing value added from where a product is filled in: the group is
 * saved with the value at the end of the field's list, so every product
 * of the group can pick it too. A value it already has is just picked.
 */
export function useAddOption(template: AttributeTemplate | null): AddOption | undefined {
  const { t } = useTranslation()
  const save = useSaveTemplate()
  if (!template) {
    return undefined
  }
  return async (key, label) => {
    const text = label.trim()
    const value = optionValue(text)
    const form = templateForm(template)
    const definition = form.definitions.find((each) => each.key === key)
    if (!definition || !value) {
      return null
    }
    if (definition.options.some((option) => option.value === value)) {
      return value
    }
    definition.options = [...definition.options, { value, label: text }]
    try {
      await save.mutateAsync({ template, form, confirm: false })
      toast.success(t("attributes.valueAdded", { value: text }))
      return value
    } catch (failure) {
      toast.error(errorText(t, failure))
      return null
    }
  }
}
