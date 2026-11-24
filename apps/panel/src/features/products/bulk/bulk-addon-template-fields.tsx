import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { addonTemplatesQuery } from "@/features/products/api/addon-templates"
import { Choices } from "@/features/products/bulk/bulk-choices"
import type { FieldsProps } from "@/features/products/bulk/bulk-fields"

const B = "products.bulk.addonTemplate"

/**
 * An add-on template linked to or unlinked from the products picked
 * (adr/0052 Ek 2026-11-23): a category's or the whole catalogue's with
 * the list's filters and "select all". A product it would take past five
 * add-ons is left out and named in the report.
 */
export function BulkAddonTemplateFields({ form, onChange, error }: FieldsProps) {
  const { t } = useTranslation()
  const templates = useQuery(addonTemplatesQuery())
  const rows = templates.data ?? []
  return (
    <>
      <Choices
        label={t(`${B}.mode`)}
        value={form.addonTemplateMode}
        onChange={(addonTemplateMode) => {
          onChange({ addonTemplateMode })
        }}
        options={(["add", "remove"] as const).map((value) => ({
          value,
          label: t(`${B}.modes.${value}`),
        }))}
      />
      <Field
        label={t(`${B}.label`)}
        hint={t(`${B}.hints.${form.addonTemplateMode}`)}
        error={error ? t(error) : undefined}
      >
        {templates.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(`${B}.none`)}{" "}
            <Link to="/settings/attributes" className="font-medium underline underline-offset-4">
              {t("products.addonTemplates.openSettings")}
            </Link>
          </p>
        ) : (
          <RadioGroup
            aria-label={t(`${B}.label`)}
            value={form.addonTemplateId}
            onValueChange={(addonTemplateId) => {
              onChange({ addonTemplateId })
            }}
            data-scroll-area="y"
            className="flex max-h-60 flex-col gap-0.5 overflow-y-auto rounded-md border p-1.5"
          >
            {rows.map((template) => (
              <label
                key={template.id}
                className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted"
              >
                <RadioGroupItem value={template.id} />
                <span className="min-w-0 truncate">
                  {template.name}
                  <span className="text-muted-foreground">
                    {" · "}
                    {template.addons.map((addon) => addon.label).join(", ")}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
        )}
      </Field>
    </>
  )
}
