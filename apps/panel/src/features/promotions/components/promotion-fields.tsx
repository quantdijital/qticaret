import { Percent, Tag, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { SectionCard } from "@/components/patterns/section-card"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import type { PromotionValues } from "@/features/promotions/form"

const KINDS: { key: PromotionValues["kind"]; icon: LucideIcon }[] = [
  { key: "percentage", icon: Percent },
  { key: "fixed", icon: Tag },
  { key: "free_shipping", icon: Truck },
]

const useError = () => {
  const { t } = useTranslation()
  const { formState } = useFormContext<PromotionValues>()
  return (name: keyof PromotionValues) => {
    const key = formState.errors[name]?.message
    return key ? t(key) : undefined
  }
}

/** What the customer gets: a percentage, an amount off the basket, or free shipping. */
export function OfferCard({ kindLocked }: { kindLocked: boolean }) {
  const { t } = useTranslation()
  const { control, register } = useFormContext<PromotionValues>()
  const kind = useWatch<PromotionValues, "kind">({ name: "kind" })
  const error = useError()
  return (
    <SectionCard title={t("promotions.form.offer")} description={t("promotions.form.offerHint")}>
      <div className="flex flex-col gap-5">
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              disabled={kindLocked}
              className="grid gap-3 sm:grid-cols-3"
            >
              {KINDS.map(({ key, icon: Icon }) => (
                <label
                  key={key}
                  className="flex cursor-pointer flex-col gap-3 rounded-lg border p-4 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70"
                >
                  <span className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-md bg-muted text-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <RadioGroupItem value={key} />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {t(`promotions.kinds.${key}.title`)}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {t(`promotions.kinds.${key}.description`)}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}
        />
        {kind === "free_shipping" ? null : (
          <Field
            label={t(
              kind === "percentage" ? "promotions.form.percentage" : "promotions.form.amount"
            )}
            htmlFor="promotion-value"
            required
            error={error("value")}
          >
            <div className="relative w-40">
              <Input
                id="promotion-value"
                inputMode="decimal"
                className="pr-8 text-right tabular-nums"
                {...register("value")}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                {kind === "percentage" ? "%" : "₺"}
              </span>
            </div>
          </Field>
        )}
      </div>
    </SectionCard>
  )
}

/** How it is used: a code the customer types, or applied on its own; how many times; when. */
// Shorter codes are easy to guess until coupon attempts are rate limited (F4)
const SAFE_CODE_LENGTH = 6

export function UsageCard({ datesLocked = false }: { datesLocked?: boolean }) {
  const { t } = useTranslation()
  const { control, register } = useFormContext<PromotionValues>()
  const [automatic, code] = useWatch<PromotionValues, ["automatic", "code"]>({
    name: ["automatic", "code"],
  })
  const shortCode = !automatic && code.trim().length > 0 && code.trim().length < SAFE_CODE_LENGTH
  const error = useError()
  return (
    <SectionCard title={t("promotions.form.usage")} description={t("promotions.form.usageHint")}>
      <div className="flex flex-col gap-5">
        <Field
          label={t("promotions.form.code")}
          htmlFor="promotion-code"
          required
          hint={t(
            automatic
              ? "promotions.form.codeAutomaticHint"
              : shortCode
                ? "promotions.form.codeShort"
                : "promotions.form.codeHint"
          )}
          error={error("code")}
        >
          <Input
            id="promotion-code"
            spellCheck={false}
            autoComplete="off"
            className="w-full font-mono uppercase sm:w-72"
            {...register("code")}
          />
        </Field>
        <label
          htmlFor="promotion-automatic"
          className="flex cursor-pointer items-start justify-between gap-4 rounded-md border px-4 py-3"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t("promotions.form.automatic")}</span>
            <span className="text-[13px] text-muted-foreground">
              {t("promotions.form.automaticHint")}
            </span>
          </span>
          <Controller
            control={control}
            name="automatic"
            render={({ field }) => (
              <Switch
                id="promotion-automatic"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </label>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field
            label={t("promotions.form.limit")}
            htmlFor="promotion-limit"
            hint={t(automatic ? "promotions.form.limitAutomatic" : "promotions.form.limitHint")}
            error={error("limit")}
          >
            <Input
              id="promotion-limit"
              inputMode="numeric"
              disabled={automatic}
              placeholder={t("promotions.form.unlimited")}
              className="tabular-nums"
              {...register("limit")}
            />
          </Field>
          <Field
            label={t("promotions.form.starts")}
            htmlFor="promotion-starts"
            hint={t(datesLocked ? "promotions.form.datesShared" : "promotions.form.startsHint")}
          >
            <Input
              id="promotion-starts"
              type="date"
              disabled={datesLocked}
              {...register("starts")}
            />
          </Field>
          <Field
            label={t("promotions.form.ends")}
            htmlFor="promotion-ends"
            hint={t("promotions.form.endsHint")}
            error={error("ends")}
          >
            <Input id="promotion-ends" type="date" disabled={datesLocked} {...register("ends")} />
          </Field>
        </div>
      </div>
    </SectionCard>
  )
}
