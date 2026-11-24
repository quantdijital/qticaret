import { useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { ADDON_LIMITS } from "@/features/products/api/addons"
import { Choices } from "@/features/products/bulk/bulk-choices"
import type { AddonDraft } from "@/features/products/detail/addon-values"
import type { AddonScope, ScopeCategory } from "./addon-scope"

const S = "products.addonScope"

interface AddonScopeFieldsProps {
  value: AddonScope
  onChange: (value: AddonScope) => void
  category: ScopeCategory | null
}

/**
 * "Kapsam", under a new add-on in the product's dialog (2026-11-23): only
 * this product, or saved as a template (named as the add-on unless
 * renamed) and linked to every product, this product's category's or
 * this one. Inside the add-on's form, so the name follows its label.
 */
export function AddonScopeFields({ value, onChange, category }: AddonScopeFieldsProps) {
  const { t } = useTranslation()
  const label = useWatch<AddonDraft, "label">({ name: "label" })
  const template = value.mode === "template"
  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <Field label={t(`${S}.title`)} hint={t(`${S}.hints.${value.mode}`)}>
        <Choices
          label={t(`${S}.title`)}
          className="sm:grid-cols-2"
          value={value.mode}
          onChange={(mode) => {
            onChange({ ...value, mode })
          }}
          options={(["product", "template"] as const).map((mode) => ({
            value: mode,
            label: t(`${S}.modes.${mode}`),
          }))}
        />
      </Field>
      {template ? (
        <>
          <Field label={t(`${S}.target`)} hint={t(`${S}.targetHint`)}>
            <Choices
              label={t(`${S}.target`)}
              value={value.target}
              onChange={(target) => {
                onChange({ ...value, target })
              }}
              options={[
                { value: "all", label: t(`${S}.targets.all`) },
                {
                  value: "category",
                  label: category
                    ? t(`${S}.targets.categoryOf`, { name: category.name })
                    : t(`${S}.targets.category`),
                  disabled: category === null,
                },
                { value: "product", label: t(`${S}.targets.product`) },
              ]}
            />
          </Field>
          <Field
            label={t("products.addonTemplates.name")}
            htmlFor="addon-scope-name"
            hint={t(`${S}.nameHint`, { max: ADDON_LIMITS.label })}
          >
            <Input
              id="addon-scope-name"
              value={value.name}
              placeholder={label}
              maxLength={ADDON_LIMITS.label}
              onChange={(event) => {
                onChange({ ...value, name: event.target.value })
              }}
            />
          </Field>
        </>
      ) : null}
    </div>
  )
}
