import { useQuery } from "@tanstack/react-query"
import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { templatesQuery } from "@/features/attributes/api"
import { AttributeInput } from "@/features/attributes/components/attribute-input"
import type { WizardValues } from "../schema"
import { productDefinitions, useWizardTemplate } from "../wizard-template"

const NONE = "__none__"

/**
 * The new product's attributes (adr/0013): a template and its product
 * fields, as on the product page, saved with the product. Drawn only when
 * the shop has a template.
 */
export function AttributesSection({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { control, setValue } = useFormContext<WizardValues>()
  const templates = useQuery(templatesQuery())
  const [templateId, values] = useWatch({ control, name: ["template_id", "attributes"] })
  const template = useWizardTemplate()
  if (!templates.data || templates.data.length === 0) {
    return null
  }
  return (
    <SectionCard
      title={t("attributes.productCard")}
      description={t("attributes.productHint")}
      className={className}
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t("attributes.template")}
          htmlFor="wizard-attributes-template"
          hint={t("attributes.templatePickHint")}
        >
          <Select
            value={templateId || NONE}
            onValueChange={(next) => {
              // Another template's fields are other fields: what was filled goes
              setValue("template_id", next === NONE ? "" : next, { shouldDirty: true })
              setValue("attributes", {}, { shouldDirty: true })
            }}
          >
            <SelectTrigger id="wizard-attributes-template" className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("attributes.noTemplate")}</SelectItem>
              {templates.data.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {template ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {productDefinitions(template).map((definition) => (
              <AttributeInput
                key={definition.key}
                definition={definition}
                value={values[definition.key]}
                onChange={(next) => {
                  setValue(
                    "attributes",
                    { ...values, [definition.key]: next },
                    { shouldDirty: true }
                  )
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </SectionCard>
  )
}
