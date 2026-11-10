import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Controller, useForm, useWatch } from "react-hook-form"
import type { Control, UseFormRegister } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { featuresQuery, useSetFeature } from "@/features/settings/api/features"
import { useSaveSection } from "@/features/settings/api/sections"
import type { CashOnDeliverySettings } from "@/features/settings/api/sections"
import { shippingOptionNamesQuery } from "@/features/settings/api/shipping-options"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import {
  formatMoneyInput,
  parseDecimalInput,
  parseMoneyInput,
} from "@qticaret/admin-ui/lib/money-input"

const C = "settings.payments.cashOnDelivery"
const FLAG = "payments.cash_on_delivery"
const FEE_TYPES = ["none", "fixed", "percent"] as const

/** Saved as kuruş (fixed) or basis points (percent): a hundredth of what is typed either way. */
const feeSchema = z
  .object({
    fee_type: z.enum(FEE_TYPES),
    fee: z.string(),
    max: z
      .string()
      .refine((text) => text.trim() === "" || parseMoneyInput(text) !== null, `${C}.amountInvalid`),
  })
  .superRefine((values, ctx) => {
    const fee = parseDecimalInput(values.fee, 2)
    if (values.fee_type !== "none" && (fee === null || fee < 0)) {
      ctx.addIssue({ code: "custom", path: ["fee"], message: `${C}.amountInvalid` })
    } else if (values.fee_type === "percent" && fee !== null && fee > 100) {
      ctx.addIssue({ code: "custom", path: ["fee"], message: `${C}.percentInvalid` })
    }
  })
type FeeValues = z.infer<typeof feeSchema>

const toValues = (saved: CashOnDeliverySettings): FeeValues => ({
  fee_type: saved.fee_type,
  fee: saved.fee_type === "none" ? "" : formatMoneyInput(saved.fee_value / 100),
  max: saved.max_amount > 0 ? formatMoneyInput(saved.max_amount / 100) : "",
})

const toSettings = (values: FeeValues): Partial<CashOnDeliverySettings> => ({
  fee_type: values.fee_type,
  fee_value:
    values.fee_type === "none" ? 0 : Math.round((parseDecimalInput(values.fee, 2) ?? 0) * 100),
  max_amount: values.max.trim() === "" ? 0 : Math.round((parseMoneyInput(values.max) ?? 0) * 100),
})

/** Offered to shoppers or not: the `payments.cash_on_delivery` flag (adr/0012). */
function StatusCard() {
  const { t } = useTranslation()
  const features = useQuery(featuresQuery())
  const set = useSetFeature()
  const enabled = features.data?.find(({ key }) => key === FLAG)?.enabled ?? false
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
              { key: FLAG, enabled: next },
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

function FeeFields({
  control,
  register,
  errors,
}: {
  control: Control<FeeValues>
  register: UseFormRegister<FeeValues>
  errors: Partial<Record<keyof FeeValues, { message?: string }>>
}) {
  const { t } = useTranslation()
  const feeType = useWatch({ control, name: "fee_type" })
  const message = (key: string | undefined) => (key ? t(key) : undefined)
  return (
    <>
      <Field label={t(`${C}.fee.type`)}>
        <Controller
          control={control}
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
          error={message(errors.fee?.message)}
        >
          <NumberField decimals={2} min={0} id="cod-fee" className="w-40" {...register("fee")} />
        </Field>
      )}
      <Field
        label={t(`${C}.max`)}
        htmlFor="cod-max"
        hint={t(`${C}.maxHint`)}
        error={message(errors.max?.message)}
      >
        <NumberField decimals={2} min={0} id="cod-max" className="w-40" {...register("max")} />
      </Field>
    </>
  )
}

/** The fee shoppers pay to pay at the door, and the largest order it takes. */
function FeeCard({ saved }: { saved: CashOnDeliverySettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<CashOnDeliverySettings>("cash_on_delivery")
  const values = toValues(saved)
  const form = useForm<FeeValues>({
    resolver: zodResolver(feeSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const submit = form.handleSubmit((next) => {
    save.mutate(toSettings(next), {
      onSuccess: (result) => {
        form.reset(toValues(result.values), FULL_RESET)
        toast.success(t("settings.saved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })
  return (
    <CardForm
      title={t(`${C}.fee.title`)}
      description={t(`${C}.fee.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <FeeFields control={form.control} register={form.register} errors={form.formState.errors} />
    </CardForm>
  )
}

/** Shipping options whose courier collects at the door: only with them is it offered. */
function ShippingCard({ saved }: { saved: CashOnDeliverySettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<CashOnDeliverySettings>("cash_on_delivery")
  const options = useQuery(shippingOptionNamesQuery())
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
