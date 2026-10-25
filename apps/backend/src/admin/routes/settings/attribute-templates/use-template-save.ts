import { toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import type { AttributeTemplate } from "../../../lib/attributes"
import { errorText } from "../../../lib/errors"
import { sdk } from "../../../lib/sdk"
import { definitionsApi } from "./form"
import type { TemplateForm } from "./form"

export const TEMPLATES_KEY = ["qticaret", "attribute-templates"]

const messageOf = (error: unknown): unknown => (error as { message?: unknown } | null)?.message

/**
 * Creates or updates a template. When an update would remove attributes
 * products have values for, the server answers `values_exist`; the user is
 * asked, and the save is sent again with `confirm_delete_values`.
 */
export function useTemplateSave(template: AttributeTemplate | undefined, onSaved: () => void) {
  const { t } = useTranslation()
  const prompt = usePrompt()
  const client = useQueryClient()

  const send = (form: TemplateForm, confirm: boolean) =>
    template
      ? sdk.client.fetch(`/admin/attribute-templates/${encodeURIComponent(template.id)}`, {
          method: "POST",
          body: {
            name: form.name.trim(),
            description: form.description.trim() === "" ? null : form.description.trim(),
            definitions: definitionsApi(form.definitions),
            ...(confirm ? { confirm_delete_values: true } : {}),
          },
        })
      : sdk.client.fetch("/admin/attribute-templates", {
          method: "POST",
          body: {
            name: form.name.trim(),
            handle: form.handle.trim(),
            description: form.description.trim() === "" ? null : form.description.trim(),
            definitions: definitionsApi(form.definitions),
          },
        })

  return useMutation({
    mutationFn: async (form: TemplateForm) => {
      try {
        return await send(form, false)
      } catch (error) {
        if (messageOf(error) !== "product_attributes.values_exist") {
          throw error
        }
        const confirmed = await prompt({
          title: t("qticaret.attributeTemplates.removeValues.title"),
          description: t("qticaret.attributeTemplates.removeValues.description"),
          confirmText: t("qticaret.attributeTemplates.removeValues.confirm"),
          cancelText: t("qticaret.common.cancel"),
        })
        if (!confirmed) {
          return null
        }
        return await send(form, true)
      }
    },
    onSuccess: async (result) => {
      if (result === null) {
        return
      }
      toast.success(t("qticaret.attributeTemplates.saved"))
      onSaved()
      await client.invalidateQueries({ queryKey: TEMPLATES_KEY })
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })
}
