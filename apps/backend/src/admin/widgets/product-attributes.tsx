import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Label, Select, Text, usePrompt } from "@medusajs/ui"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { ErrorState, LoadingRows } from "../components/page-states"
import { AttributeInput } from "../components/product-attributes/attribute-input"
import { useProductAttributes } from "../components/product-attributes/use-product-attributes"
import type { ProductAttributesForm } from "../components/product-attributes/use-product-attributes"
import type { ProductAttributes } from "../lib/attributes"
import { errorText } from "../lib/errors"

const NO_TEMPLATE = "__none__"

const formOf = (attributes: ProductAttributes): ProductAttributesForm => ({
  template_id: attributes.template?.id ?? null,
  values: attributes.values,
})

/**
 * Product attributes on the product page (F2.4, adr/0013): pick the
 * template, fill its product attributes. Variant attributes come from the
 * product's options and are only named here.
 */
function ProductAttributesWidget({ data: product }: DetailWidgetProps<AdminProduct>) {
  const { t } = useTranslation()
  const prompt = usePrompt()
  const form = useForm<ProductAttributesForm>({ defaultValues: { template_id: null, values: {} } })
  const { attributes, templates, save } = useProductAttributes(product.id, (saved) => {
    form.reset(formOf(saved))
  })
  useEffect(() => {
    if (attributes.data) {
      form.reset(formOf(attributes.data))
    }
  }, [attributes.data, form])

  const templateId = form.watch("template_id")
  const template = templates.data?.attribute_templates.find((item) => item.id === templateId)
  const definitions = [...(template?.definitions ?? [])].sort((a, b) => a.rank - b.rank)

  const changeTemplate = async (next: string | null) => {
    const hasValues = Object.keys(attributes.data?.values ?? {}).length > 0
    const current = attributes.data?.template?.id ?? null
    if (hasValues && next !== current) {
      const confirmed = await prompt({
        title: t("qticaret.attributes.changeTemplate.title"),
        description: t("qticaret.attributes.changeTemplate.description"),
        confirmText: t("qticaret.attributes.changeTemplate.confirm"),
        cancelText: t("qticaret.attributes.changeTemplate.cancel"),
      })
      if (!confirmed) {
        return
      }
    }
    form.setValue("template_id", next, { shouldDirty: true })
    form.setValue("confirm_template_change", hasValues && next !== current)
    form.setValue("values", next === current ? (attributes.data?.values ?? {}) : {}, {
      shouldDirty: true,
    })
  }

  const submit = form.handleSubmit((values) => {
    const missing = definitions.filter(
      (definition) =>
        definition.scope === "product" &&
        definition.is_required &&
        (values.values[definition.key] === null || values.values[definition.key] === undefined)
    )
    for (const definition of missing) {
      form.setError(`values.${definition.key}`, { message: t("qticaret.attributes.required") })
    }
    if (missing.length === 0) {
      save.mutate(values)
    }
  })

  const loading = attributes.isPending || templates.isPending
  const failure = attributes.error ?? templates.error
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{t("qticaret.attributes.title")}</Heading>
      </div>
      <div className="flex flex-col gap-4 px-6 py-4">
        {loading ? (
          <LoadingRows rows={2} />
        ) : failure ? (
          <ErrorState
            text={errorText(t, failure)}
            onRetry={() => {
              void attributes.refetch()
              void templates.refetch()
            }}
          />
        ) : (templates.data?.attribute_templates.length ?? 0) === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            {t("qticaret.attributes.noTemplates")}
          </Text>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              void submit(event)
            }}
          >
            <div className="flex flex-col gap-2">
              <Label size="small" weight="plus">
                {t("qticaret.attributes.template")}
              </Label>
              <Select
                value={templateId ?? NO_TEMPLATE}
                onValueChange={(value) => void changeTemplate(value === NO_TEMPLATE ? null : value)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value={NO_TEMPLATE}>
                    {t("qticaret.attributes.noTemplate")}
                  </Select.Item>
                  {templates.data?.attribute_templates.map((item) => (
                    <Select.Item key={item.id} value={item.id}>
                      {item.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            {definitions.map((definition) =>
              definition.scope === "variant" ? (
                <Text key={definition.id} size="small" className="text-ui-fg-subtle">
                  {t("qticaret.attributes.variantAttribute", {
                    label: definition.label,
                    option: definition.option_title ?? "",
                  })}
                </Text>
              ) : (
                <Controller
                  key={definition.id}
                  control={form.control}
                  name={`values.${definition.key}`}
                  render={({ field, fieldState }) => (
                    <AttributeInput
                      definition={definition}
                      value={field.value}
                      error={fieldState.error?.message}
                      onChange={field.onChange}
                    />
                  )}
                />
              )
            )}
            <div className="flex justify-end">
              <Button
                type="submit"
                size="small"
                disabled={!form.formState.isDirty}
                isLoading={save.isPending}
              >
                {t("qticaret.common.save")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductAttributesWidget
