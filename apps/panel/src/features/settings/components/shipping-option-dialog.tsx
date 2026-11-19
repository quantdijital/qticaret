import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
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
  useUpdateShippingOption,
} from "@/features/settings/api/shipping-options"
import type {
  NewShippingOption,
  ShopShippingOption,
} from "@/features/settings/api/shipping-options"
import { errorText } from "@/lib/errors"
import { formatMoneyInput, parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"

const S = "settings.shipping.options"
const CARRIERS = ["manual", "geliver", "aras", "yurtici", "pickup"] as const
const PRICINGS = ["flat", "cheapest", "fastest", "table"] as const
type Carrier = (typeof CARRIERS)[number]
type Pricing = (typeof PRICINGS)[number]

// Geliver quotes; a contract carrier (adr/0035) takes a flat price or the shop's table
const PRICINGS_OF: Readonly<Record<Carrier, readonly Pricing[]>> = {
  manual: ["flat"],
  geliver: PRICINGS,
  aras: ["flat", "table"],
  yurtici: ["flat", "table"],
  pickup: ["flat"],
}

/** The pricing the carrier takes: the one chosen, or a flat price when it takes no other. */
const pricingFor = (carrier: Carrier, pricing: Pricing): Pricing =>
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

/** The server's body for the form: Geliver quotes; Geliver and the contract carriers price by the table. */
function newOption(values: Values): NewShippingOption {
  const chosen = pricingFor(values.carrier, values.pricing)
  const pricing: NewShippingOption["pricing"] =
    chosen === "flat"
      ? { type: "flat", amount: parseMoneyInput(values.amount) ?? 0 }
      : chosen === "table"
        ? { type: "table" }
        : { type: "quote", choice: chosen }
  return { name: values.name.trim(), carrier: values.carrier, pricing }
}

/**
 * A shipping option, new or renamed (F7.8): what shoppers see, who carries
 * it and how it is priced; an option already made changes only its name
 * and, when flat, its amount.
 */
export function ShippingOptionDialog({
  option,
  open,
  onOpenChange,
}: {
  /** The option to change; a new one when absent. */
  option?: ShopShippingOption | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const create = useCreateShippingOption()
  const update = useUpdateShippingOption()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: option?.name ?? "",
      carrier: option?.carrier ?? "geliver",
      pricing: option?.pricing ?? "cheapest",
      amount: option?.amount ? formatMoneyInput(Number(option.amount)) : "",
    },
  })
  const carrier = useWatch({ control: form.control, name: "carrier" })
  const pricing = useWatch({ control: form.control, name: "pricing" })
  const flat = pricingFor(carrier, pricing) === "flat"
  const { errors } = form.formState
  const busy = create.isPending || update.isPending
  const done = () => {
    toast.success(t("settings.saved"))
    onOpenChange(false)
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t(option ? `${S}.editTitle` : `${S}.addTitle`)}</DialogTitle>
          <DialogDescription>{t(`${S}.dialogDescription`)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field
            label={t(`${S}.name`)}
            htmlFor="shipping-option-name"
            hint={t(`${S}.nameHint`)}
            error={errors.name?.message ? t(errors.name.message) : undefined}
          >
            <Input id="shipping-option-name" maxLength={80} {...form.register("name")} />
          </Field>
          {option ? null : (
            <Field label={t(`${S}.carrier`)} htmlFor="shipping-option-carrier">
              <Controller
                control={form.control}
                name="carrier"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
              htmlFor="shipping-option-amount"
              hint={t(`${S}.amountHint`)}
              error={errors.amount?.message ? t(errors.amount.message) : undefined}
            >
              <NumberField
                decimals={2}
                min={0}
                id="shipping-option-amount"
                className="w-40"
                {...form.register("amount")}
              />
            </Field>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="cancel"
            onClick={() => {
              onOpenChange(false)
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button disabled={busy} onClick={() => void submit()}>
            {t(option ? "common.save" : `${S}.add`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
