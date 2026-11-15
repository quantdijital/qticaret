import { useQuery } from "@tanstack/react-query"
import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { tierOptionsQuery } from "@/features/wholesale/api/tiers"

/** The fields both wholesaler windows share: where the prices come from, and the minimum. */
export interface PriceSourceValues {
  tier_id: string
  own_prices: boolean
  percent: string
  min_quantity: string
}

const F = "wholesale.form"
// Radix's Select takes no empty value: "no level" is this
const NONE = "none"

/**
 * A level and/or prices of the wholesaler's own (ADR-0068 §1): the own
 * list's rate here, its single prices on the wholesaler's page. Once
 * open, the own list is not closed from here (the server keeps it).
 */
export function PriceSourceFields({ ownLocked = false }: { ownLocked?: boolean }) {
  const { t } = useTranslation()
  const tiers = useQuery(tierOptionsQuery())
  const { control, register, watch, formState } = useFormContext<PriceSourceValues>()
  const own = watch("own_prices")
  const message = (key: string | undefined) => (key ? t(key) : undefined)
  const { errors } = formState
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label={t(`${F}.tier`)}
        htmlFor="wholesale-tier"
        hint={t(`${F}.tierHint`)}
        error={message(errors.tier_id?.message)}
      >
        <Controller
          control={control}
          name="tier_id"
          render={({ field }) => (
            <Select
              value={field.value === "" ? NONE : field.value}
              onValueChange={(next) => {
                field.onChange(next === NONE ? "" : next)
              }}
            >
              <SelectTrigger id="wholesale-tier" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t(`${F}.noTier`)}</SelectItem>
                {(tiers.data ?? []).map((tier) => (
                  <SelectItem key={tier.id} value={tier.id}>
                    {tier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field
        label={t(`${F}.minimum`)}
        htmlFor="wholesale-minimum"
        hint={t(`${F}.minimumHint`)}
        error={message(errors.min_quantity?.message)}
      >
        <NumberField
          id="wholesale-minimum"
          min={1}
          suffix={t(`${F}.units`)}
          {...register("min_quantity")}
        />
      </Field>
      <div className="flex items-start justify-between gap-4 rounded-md border px-4 py-3 sm:col-span-2">
        <label htmlFor="wholesale-own" className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{t(`${F}.ownPrices`)}</span>
          <span className="text-[13px] text-muted-foreground">
            {t(ownLocked ? `${F}.ownPricesOpen` : `${F}.ownPricesHint`)}
          </span>
        </label>
        <Controller
          control={control}
          name="own_prices"
          render={({ field }) => (
            <Switch
              id="wholesale-own"
              checked={field.value}
              disabled={ownLocked}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
      {own ? (
        <Field
          label={t(`${F}.ownPercent`)}
          htmlFor="wholesale-percent"
          hint={t(`${F}.ownPercentHint`)}
          error={message(errors.percent?.message)}
          className="sm:col-span-2"
        >
          <NumberField
            id="wholesale-percent"
            decimals={2}
            min={0}
            max={99}
            suffix="%"
            className="w-40"
            {...register("percent")}
          />
        </Field>
      ) : null}
    </div>
  )
}
