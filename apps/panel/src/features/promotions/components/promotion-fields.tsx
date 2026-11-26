import { Gift, Percent, Tag, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Input } from "@qticaret/admin-ui/ui/input"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { PromotionValues } from "@/features/promotions/form"

const KINDS: { key: PromotionValues["kind"]; icon: LucideIcon }[] = [
  { key: "percentage", icon: Percent },
  { key: "fixed", icon: Tag },
  { key: "free_shipping", icon: Truck },
  { key: "buyget", icon: Gift },
]

const useError = () => {
  const { t } = useTranslation()
  const { formState } = useFormContext<PromotionValues>()
  return (name: keyof PromotionValues) => {
    const key = formState.errors[name]?.message
    return key ? t(key) : undefined
  }
}

/** "X al Y öde": how many are taken and how many paid for, as the shop says it. */
function BuyGetFields() {
  const { t } = useTranslation()
  const { register } = useFormContext<PromotionValues>()
  const error = useError()
  return (
    <Field
      label={t("promotions.form.buyget")}
      hint={t("promotions.form.buygetHint")}
      error={error("buyCount")}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <NumberField
          min={1}
          aria-label={t("promotions.form.buyCount")}
          className="w-28"
          {...register("buyCount")}
        />
        <span>{t("promotions.form.buyWord")}</span>
        <NumberField
          min={1}
          aria-label={t("promotions.form.payCount")}
          className="w-28"
          {...register("payCount")}
        />
        <span>{t("promotions.form.payWord")}</span>
      </div>
    </Field>
  )
}

/** What the customer gets: a percentage or an amount off, free shipping, or "X al Y öde". */
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
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
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
        {kind === "buyget" ? <BuyGetFields /> : null}
        {kind === "free_shipping" || kind === "buyget" ? null : (
          <Field
            label={t(
              kind === "percentage" ? "promotions.form.percentage" : "promotions.form.amount"
            )}
            htmlFor="promotion-value"
            required
            error={error("value")}
          >
            <NumberField
              decimals={2}
              min={0}
              max={kind === "percentage" ? 100 : undefined}
              className="w-44"
              suffix={kind === "percentage" ? "%" : "₺"}
              id="promotion-value"
              {...register("value")}
            />
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
            placeholder={t("promotions.placeholders.code")}
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
            <NumberField
              min={1}
              id="promotion-limit"
              disabled={automatic}
              placeholder={t("promotions.form.unlimited")}

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
