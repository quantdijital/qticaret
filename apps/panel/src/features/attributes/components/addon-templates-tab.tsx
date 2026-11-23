import { useQuery } from "@tanstack/react-query"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import type { TemplateForm } from "@/features/attributes/form"
import { addonTemplatesQuery } from "@/features/products/api/addon-templates"
import { errorText } from "@/lib/errors"

const A = "attributes.addonTemplates"

/**
 * The add-on templates an attribute template carries (adr/0052 Ek
 * 2026-11-23): every product following it gets their add-ons, live. One
 * ticked is added at the end; the product page shows them in this order.
 */
export function AddonTemplatesTab() {
  const { t } = useTranslation()
  const { control } = useFormContext<TemplateForm>()
  const templates = useQuery(addonTemplatesQuery())
  if (templates.isError) {
    return (
      <ErrorState text={errorText(t, templates.error)} onRetry={() => void templates.refetch()} />
    )
  }
  if (templates.isPending) {
    return <LoadingRows rows={3} />
  }
  const rows = templates.data
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted-foreground">{t(`${A}.hint`)}</p>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
          {t(`${A}.none`)}
        </p>
      ) : (
        <Controller
          control={control}
          name="addonTemplateIds"
          render={({ field }) => (
            <ul className="flex flex-col divide-y rounded-md border">
              {rows.map((template) => {
                const checked = field.value.includes(template.id)
                const id = `carry-${template.id}`
                return (
                  <li key={template.id} className="flex items-start gap-3 px-3 py-2.5">
                    <Checkbox
                      id={id}
                      checked={checked}
                      className="mt-0.5"
                      onCheckedChange={(next) => {
                        field.onChange(
                          next === true
                            ? [...field.value, template.id]
                            : field.value.filter((each) => each !== template.id)
                        )
                      }}
                    />
                    <label htmlFor={id} className="flex min-w-0 cursor-pointer flex-col gap-0.5">
                      <span className="text-sm font-medium">{template.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {template.addons.map((addon) => addon.label).join(", ")}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        />
      )}
    </div>
  )
}
