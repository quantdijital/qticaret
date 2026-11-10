import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { useFeature } from "@/features/settings/api/features"
import type { WizardValues } from "../schema"
import { syncVariants } from "../variants"
import { OptionsEditor } from "./options-editor"
import { SingleVariant, VariantsTable } from "./variants-table"

interface ToggleRowProps {
  id: string
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleRow({ id, title, description, checked, onChange }: ToggleRowProps) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-[13px] leading-5 text-muted-foreground">{description}</span>
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </label>
  )
}

/** Step 3: what it costs, how many there are and in which sizes or colours. */
export function PricingStep() {
  const { t } = useTranslation()
  const { control, setValue, getValues, formState } = useFormContext<WizardValues>()
  const [hasOptions, options, variants, manage, backorder] = useWatch({
    control,
    name: ["has_options", "options", "variants", "manage_inventory", "allow_backorder"],
  })
  const multi = hasOptions && variants.length > 1
  // Selling past stock needs the preorder flag; one already on can still be turned off
  const preorder = useFeature("stock.preorder") || backorder
  // The list's own error (none, or a missing option) first, then the first option's
  const optionMessage =
    formState.errors.options?.message ??
    formState.errors.options?.root?.message ??
    options
      .map((_, index) => formState.errors.options?.[index])
      .flatMap((error) => [error?.title?.message, error?.values?.message])
      .find(Boolean)

  const updateOptions = (next: WizardValues["options"], nextHasOptions = hasOptions) => {
    setValue("options", next, { shouldDirty: true })
    setValue("variants", syncVariants(next, getValues("variants"), nextHasOptions), {
      shouldDirty: true,
    })
  }

  return (
    <div className="grid gap-[var(--grid-gap)] xl:grid-cols-12">
      <div className="flex flex-col gap-[var(--grid-gap)] xl:col-span-8">
        <SectionCard
          title={t("products.wizard.optionsCard")}
          description={t("products.wizard.optionsHint")}
          action={
            <Switch
              aria-label={t("products.wizard.hasOptions")}
              checked={hasOptions}
              onCheckedChange={(checked) => {
                setValue("has_options", checked, { shouldDirty: true })
                // Off clears the options: hidden ones must not hold the step back
                updateOptions(
                  checked ? (options.length ? options : [{ title: "", values: [] }]) : [],
                  checked
                )
              }}
            />
          }
        >
          {hasOptions ? (
            <div className="flex flex-col gap-2">
              <OptionsEditor options={options} onChange={updateOptions} />
              {optionMessage ? (
                <p role="alert" className="text-xs text-destructive-text">
                  {t(optionMessage)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("products.wizard.noOptions")}</p>
          )}
        </SectionCard>
        <SectionCard
          title={t("products.wizard.pricingCard")}
          description={t("products.wizard.pricingHint")}
        >
          {multi ? <VariantsTable /> : <SingleVariant />}
        </SectionCard>
      </div>
      <SectionCard title={t("products.wizard.inventoryCard")} className="xl:col-span-4">
        <div className="flex flex-col divide-y">
          <ToggleRow
            id="manage-inventory"
            title={t("products.wizard.manageInventory")}
            description={t("products.wizard.manageInventoryHint")}
            checked={manage}
            onChange={(checked) => {
              setValue("manage_inventory", checked, { shouldDirty: true })
            }}
          />
          {preorder ? (
            <ToggleRow
              id="allow-backorder"
              title={t("products.wizard.allowBackorder")}
              description={t("products.wizard.allowBackorderHint")}
              checked={backorder}
              onChange={(checked) => {
                setValue("allow_backorder", checked, { shouldDirty: true })
              }}
            />
          ) : null}
        </div>
      </SectionCard>
    </div>
  )
}
