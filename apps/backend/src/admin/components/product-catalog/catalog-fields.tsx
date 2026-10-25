import { Input, Label, Select, Table, Text } from "@medusajs/ui"
import { Controller } from "react-hook-form"
import type { Control, UseFormRegister } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { CONDITIONS } from "../../lib/catalog"
import type { Condition, ProductCatalog, ProductRef } from "../../lib/catalog"

export const NO_CATEGORY = "__none__"

export interface CatalogFormValues {
  condition: Condition
  primary_category_id: string
  successor: ProductRef | null
  mpn: Record<string, string>
}

interface FieldProps {
  control: Control<CatalogFormValues>
  catalog: ProductCatalog
}

export function ConditionField({ control }: Pick<FieldProps, "control">) {
  const { t } = useTranslation()
  return (
    <Controller
      control={control}
      name="condition"
      render={({ field }) => (
        <div className="flex flex-col gap-2">
          <Label size="small" weight="plus">
            {t("qticaret.catalog.condition.label")}
          </Label>
          <Select value={field.value} onValueChange={field.onChange}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {CONDITIONS.map((condition) => (
                <Select.Item key={condition} value={condition}>
                  {t(`qticaret.catalog.condition.options.${condition}`)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      )}
    />
  )
}

/** Picked from the product's own categories; none until it has one. */
export function PrimaryCategoryField({ control, catalog }: FieldProps) {
  const { t } = useTranslation()
  const empty = catalog.categories.length === 0
  return (
    <Controller
      control={control}
      name="primary_category_id"
      render={({ field }) => (
        <div className="flex flex-col gap-2">
          <Label size="small" weight="plus">
            {t("qticaret.catalog.primaryCategory.label")}
          </Label>
          <Select value={field.value} onValueChange={field.onChange} disabled={empty}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={NO_CATEGORY}>
                {t("qticaret.catalog.primaryCategory.none")}
              </Select.Item>
              {catalog.categories.map((category) => (
                <Select.Item key={category.id} value={category.id}>
                  {category.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Text size="xsmall" className="text-ui-fg-subtle">
            {empty
              ? t("qticaret.catalog.primaryCategory.noCategories")
              : t("qticaret.catalog.primaryCategory.hint")}
          </Text>
        </div>
      )}
    />
  )
}

interface VariantCodesProps {
  catalog: ProductCatalog
  register: UseFormRegister<CatalogFormValues>
}

/** Each variant's GTIN as structured data will use it, and its MPN to edit. */
export function VariantCodes({ catalog, register }: VariantCodesProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <Label size="small" weight="plus">
        {t("qticaret.catalog.variants.title")}
      </Label>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>{t("qticaret.catalog.variants.variant")}</Table.HeaderCell>
            <Table.HeaderCell>{t("qticaret.catalog.variants.gtin")}</Table.HeaderCell>
            <Table.HeaderCell>{t("qticaret.catalog.variants.mpn")}</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {catalog.variants.map((variant) => (
            <Table.Row key={variant.id}>
              <Table.Cell>{variant.title ?? variant.sku ?? variant.id}</Table.Cell>
              <Table.Cell>
                {variant.gtin ?? (
                  <span className="text-ui-fg-subtle">{t("qticaret.catalog.variants.noGtin")}</span>
                )}
              </Table.Cell>
              <Table.Cell>
                <Input
                  size="small"
                  maxLength={70}
                  aria-label={t("qticaret.catalog.variants.mpn")}
                  {...register(`mpn.${variant.id}`)}
                />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <Text size="xsmall" className="text-ui-fg-subtle">
        {t("qticaret.catalog.variants.hint")}
      </Text>
    </div>
  )
}
