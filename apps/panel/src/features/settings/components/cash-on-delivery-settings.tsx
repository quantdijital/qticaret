import { useQuery } from "@tanstack/react-query"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { SectionCard } from "@/components/patterns/section-card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { featuresQuery, useSetFeature } from "@/features/settings/api/features"
import { useSaveSection } from "@/features/settings/api/sections"
import type { CashOnDeliverySettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { formatMoneyInput, parseDecimalInput, parseMoneyInput } from "@/lib/money-input"
import { sdk } from "@/lib/sdk"

const C = "settings.payments.cashOnDelivery"
const FEE_TYPES = ["none", "fixed", "percent"] as const

/** Offered to shoppers or not: the `cash_on_delivery` flag (adr/0012). */
function StatusCard() {
  const { t } = useTranslation()
  const features = useQuery(featuresQuery())
  const set = useSetFeature()
  const enabled =
    features.data?.find(({ key }) => key === "payments.cash_on_delivery")?.enabled ?? false
  return (
    <SectionCard title={t(`${C}.status.title`)} description={t(`${C}.status.description`)}>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="cod-enabled" className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{t(`${C}.status.enabled`)}</span>
          <span className="text-[13px] text-muted-foreground">{t(`${C}.status.enabledHint`)}</span>
        </label>
        <Switch
          id="cod-enabled"
          checked={enabled}
          disabled={!features.data || set.isPending}
          onCheckedChange={(next) => {
            set.mutate(
              { key: "payments.cash_on_delivery", enabled: next },
              {
                onSuccess: () => toast.success(t("settings.saved")),
                onError: (failure) => toast.error(errorText(t, failure)),
              }
            )
          }}
        />
      </div>
    </SectionCard>
  )
}

interface FeeValues {
  fee_type: CashOnDeliverySettings["fee_type"]
  /** Lira for a fixed fee, percent for a share, as typed. */
  fee: string
  /** Lira; empty: no limit. */
  max: string
}

const feeText = (saved: CashOnDeliverySettings) =>
  saved.fee_type === "fixed"
    ? formatMoneyInput(saved.fee_value / 100)
    : saved.fee_type === "percent"
      ? formatMoneyInput(saved.fee_value / 100)
      : ""

/** The fee shoppers pay to pay at the door, and the largest order it takes. */
function FeeCard({ saved }: { saved: CashOnDeliverySettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<CashOnDeliverySettings>("cash_on_delivery")
  const values: FeeValues = {
    fee_type: saved.fee_type,
    fee: feeText(saved),
    max: saved.max_amount > 0 ? formatMoneyInput(saved.max_amount / 100) : "",
  }
  const form = useForm<FeeValues>({ values, resetOptions: { keepDirtyValues: true } })
  const submit = form.handleSubmit((next) => {
    const fee = next.fee_type === "none" ? 0 : parseDecimalInput(next.fee, 2)
    const max = next.max.trim() === "" ? 0 : parseMoneyInput(next.max)
    if (fee === null || max === null || (next.fee_type === "percent" && fee > 100)) {
      toast.error(t(`${C}.invalid`))
      return
    }
    save.mutate(
      {
        fee_type: next.fee_type,
        // Kuruş for a fixed fee, basis points for a share: both a hundredth of what was typed
        fee_value: Math.round(fee * 100),
        max_amount: Math.round(max * 100),
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  const feeType = useWatch({ control: form.control, name: "fee_type" })
  return (
    <CardForm
      title={t(`${C}.fee.title`)}
      description={t(`${C}.fee.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values)
      }}
    >
      <Field label={t(`${C}.fee.type`)}>
        <Controller
          control={form.control}
          name="fee_type"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="flex flex-wrap gap-4"
            >
              {FEE_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={type} />
                  {t(`${C}.fee.types.${type}`)}
                </label>
              ))}
            </RadioGroup>
          )}
        />
      </Field>
      {feeType === "none" ? null : (
        <Field
          label={t(feeType === "fixed" ? `${C}.fee.amount` : `${C}.fee.percent`)}
          htmlFor="cod-fee"
          hint={t(`${C}.fee.hint`)}
        >
          <Input id="cod-fee" inputMode="decimal" className="w-40" {...form.register("fee")} />
        </Field>
      )}
      <Field label={t(`${C}.max`)} htmlFor="cod-max" hint={t(`${C}.maxHint`)}>
        <Input id="cod-max" inputMode="decimal" className="w-40" {...form.register("max")} />
      </Field>
    </CardForm>
  )
}

/** Shipping options whose courier collects at the door: only with them is it offered. */
function ShippingCard({ saved }: { saved: CashOnDeliverySettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<CashOnDeliverySettings>("cash_on_delivery")
  const options = useQuery({
    queryKey: ["settings", "shipping-options", "names"],
    queryFn: async () =>
      (await sdk.admin.shippingOption.list({ fields: "id,name", limit: 100 })).shipping_options,
  })
  const chosen = new Set(saved.shipping_option_ids)
  const toggle = (id: string, on: boolean) => {
    const next = on
      ? [...saved.shipping_option_ids, id]
      : saved.shipping_option_ids.filter((each) => each !== id)
    save.mutate(
      { shipping_option_ids: next },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <SectionCard title={t(`${C}.shipping.title`)} description={t(`${C}.shipping.description`)}>
      {options.data?.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t(`${C}.shipping.none`)}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {(options.data ?? []).map((option) => (
            <li key={option.id}>
              <label className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={chosen.has(option.id)}
                  disabled={save.isPending}
                  onCheckedChange={(on) => {
                    toggle(option.id, on === true)
                  }}
                />
                {option.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

/** Settings > Payment > Cash on delivery (F6, adr/0029). */
export function CashOnDeliverySettingsCards({ saved }: { saved: CashOnDeliverySettings }) {
  return (
    <div className="flex flex-col gap-6">
      <StatusCard />
      <FeeCard saved={saved} />
      <ShippingCard saved={saved} />
    </div>
  )
}
