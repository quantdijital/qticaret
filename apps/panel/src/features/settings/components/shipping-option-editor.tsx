import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import {
  useCreateShippingOption,
  useDeleteShippingOption,
  useUpdateShippingOption,
} from "@/features/settings/api/shipping-options"
import type {
  NewShippingOption,
  ShopShippingOption,
} from "@/features/settings/api/shipping-options"
import { errorText } from "@/lib/errors"
import { formatMoneyInput, parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"

const S = "settings.shipping.options"
const CARRIERS = ["manual", "aras", "yurtici", "dhlecommerce", "surat", "ptt", "pickup"] as const
const PRICINGS = ["flat", "table"] as const
export type OptionCarrier = (typeof CARRIERS)[number]
type Pricing = (typeof PRICINGS)[number]

// A contract carrier (adr/0035) takes a flat price or the shop's table
const PRICINGS_OF: Readonly<Record<OptionCarrier, readonly Pricing[]>> = {
  manual: ["flat"],
  aras: ["flat", "table"],
  yurtici: ["flat", "table"],
  dhlecommerce: ["flat", "table"],
  surat: ["flat", "table"],
  ptt: ["flat", "table"],
  pickup: ["flat"],
}

/** The pricing the carrier takes: the one chosen, or a flat price when it takes no other. */
const pricingFor = (carrier: OptionCarrier, pricing: Pricing): Pricing =>
  PRICINGS_OF[carrier].includes(pricing) ? pricing : "flat"

const schema = z
  .object({
    name: z.string().trim().min(1, `${S}.nameRequired`).max(80),
    carrier: z.enum(CARRIERS),
    pricing: z.enum(PRICINGS),
    amount: z.string(),
  })
  .superRefine((values, ctx) => {
    const amount = parseMoneyInput(values.amount)
    if (pricingFor(values.carrier, values.pricing) === "flat" && (amount === null || amount < 0)) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: `${S}.amountInvalid` })
    }
  })
type Values = z.infer<typeof schema>

/** The server's body for the form: a flat price, or the contract carrier's table. */
function newOption(values: Values): NewShippingOption {
  const pricing: NewShippingOption["pricing"] =
    pricingFor(values.carrier, values.pricing) === "flat"
      ? { type: "flat", amount: parseMoneyInput(values.amount) ?? 0 }
      : { type: "table" }
  return { name: values.name.trim(), carrier: values.carrier, pricing }
}

/** Remove, asked again in place: a warning, then the press that does it. */
function RemoveButton({
  option,
  busy,
  onRemove,
}: {
  option: ShopShippingOption
  busy: boolean
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="mr-auto text-destructive-text"
        aria-label={t(`${S}.remove`, { name: option.name })}
        onClick={() => {
          setAsking(true)
        }}
      >
        {t(`${S}.removeConfirm`)}
      </Button>
    )
  }
  return (
    <span className="mr-auto flex flex-wrap items-center gap-2 text-[13px] text-warning-text">
      <span role="status">{t(`${S}.removeDescription`)}</span>
      <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onRemove}>
        {t(`${S}.removeConfirm`)}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="cancel"
        onClick={() => {
          setAsking(false)
        }}
      >
        {t(`${S}.keep`)}
      </Button>
    </span>
  )
}

/**
 * A shipping option edited in its own row (F7.8; the owner, 2026-11-26: no
 * dialog): what shoppers see, who carries it and how it is priced. One
 * already made changes only its name and, when flat, its amount; it is
 * removed here after a second press.
 */
export function ShippingOptionEditor({
  option,
  carrier: firstCarrier = "manual",
  onDone,
}: {
  /** The option to change; a new one when absent. */
  option?: ShopShippingOption | undefined
  /** A new option's carrier: the shop's first connected one, else its own delivery. */
  carrier?: OptionCarrier
  onDone: () => void
}) {
  const { t } = useTranslation()
  const create = useCreateShippingOption()
  const update = useUpdateShippingOption()
  const remove = useDeleteShippingOption()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: option?.name ?? t(`${S}.defaultName`),
      carrier: option?.carrier ?? firstCarrier,
      pricing: option?.pricing ?? "flat",
      amount: option?.amount ? formatMoneyInput(Number(option.amount)) : "",
    },
  })
  const carrier = useWatch({ control: form.control, name: "carrier" })
  const pricing = useWatch({ control: form.control, name: "pricing" })
  const flat = pricingFor(carrier, pricing) === "flat"
  const { errors } = form.formState
  const busy = create.isPending || update.isPending || remove.isPending
  const done = () => {
    toast.success(t("settings.saved"))
    onDone()
  }
  const failed = (failure: unknown) => toast.error(errorText(t, failure))
  const submit = form.handleSubmit((values) => {
    if (option) {
      update.mutate(
        {
          id: option.id,
          name: values.name.trim(),
          ...(option.pricing === "flat" ? { amount: parseMoneyInput(values.amount) ?? 0 } : {}),
        },
        { onSuccess: done, onError: failed }
      )
      return
    }
    create.mutate(newOption(values), { onSuccess: done, onError: failed })
  })
  const id = option?.id ?? "new"
  return (
    <form
      noValidate
      aria-label={option ? t(`${S}.edit`, { name: option.name }) : t(`${S}.addTitle`)}
      className="flex flex-col gap-4 pt-3"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t(`${S}.name`)}
          htmlFor={`shipping-option-name-${id}`}
          error={errors.name?.message ? t(errors.name.message) : undefined}
        >
          <Input
            id={`shipping-option-name-${id}`}
            maxLength={80}
            placeholder={t(`${S}.namePlaceholder`)}
            {...form.register("name")}
          />
        </Field>
        {option ? null : (
          <Field label={t(`${S}.carrier`)} htmlFor="shipping-option-carrier">
            <Controller
              control={form.control}
              name="carrier"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(next) => {
                    field.onChange(next)
                    form.setValue("pricing", "flat")
                  }}
                >
                  <SelectTrigger id="shipping-option-carrier" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIERS.map((each) => (
                      <SelectItem key={each} value={each}>
                        {t(`${S}.carriers.${each}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}
        {option || PRICINGS_OF[carrier].length === 1 ? null : (
          <Field label={t(`${S}.pricing`)} htmlFor="shipping-option-pricing">
            <Controller
              control={form.control}
              name="pricing"
              render={({ field }) => (
                <Select value={pricingFor(carrier, field.value)} onValueChange={field.onChange}>
                  <SelectTrigger id="shipping-option-pricing" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICINGS_OF[carrier].map((each) => (
                      <SelectItem key={each} value={each}>
                        {t(`${S}.pricings.${each}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}
        {flat && (!option || option.pricing === "flat") ? (
          <Field
            label={t(`${S}.amount`)}
            htmlFor={`shipping-option-amount-${id}`}
            hint={t(`${S}.amountHint`)}
            error={errors.amount?.message ? t(errors.amount.message) : undefined}
          >
            <NumberField
              decimals={2}
              min={0}
              suffix="₺"
              id={`shipping-option-amount-${id}`}
              className="w-40"
              {...form.register("amount")}
            />
          </Field>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {option ? (
          <RemoveButton
            option={option}
            busy={busy}
            onRemove={() => {
              remove.mutate(option.id, {
                onSuccess: () => {
                  toast.success(t(`${S}.removed`))
                  onDone()
                },
                onError: failed,
              })
            }}
          />
        ) : null}
        <Button type="button" size="sm" variant="cancel" disabled={busy} onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {t(option ? "common.save" : `${S}.add`)}
        </Button>
      </div>
    </form>
  )
}
