import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCreateShippingOption,
  useUpdateShippingOption,
} from "@/features/settings/api/shipping-options"
import type {
  NewShippingOption,
  ShopShippingOption,
} from "@/features/settings/api/shipping-options"
import { errorText } from "@/lib/errors"
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input"

const S = "settings.shipping.options"
const CARRIERS = ["manual", "geliver", "pickup"] as const
const PRICINGS = ["flat", "cheapest", "fastest", "table"] as const

const schema = z
  .object({
    name: z.string().trim().min(1, `${S}.nameRequired`).max(80),
    carrier: z.enum(CARRIERS),
    pricing: z.enum(PRICINGS),
    amount: z.string(),
  })
  .superRefine((values, ctx) => {
    const amount = parseMoneyInput(values.amount)
    if (values.pricing === "flat" && (amount === null || amount < 0)) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: `${S}.amountInvalid` })
    }
  })
type Values = z.infer<typeof schema>

/** The server's body for the form: only Geliver quotes or prices by the table. */
function newOption(values: Values): NewShippingOption {
  const pricing: NewShippingOption["pricing"] =
    values.carrier !== "geliver" || values.pricing === "flat"
      ? { type: "flat", amount: parseMoneyInput(values.amount) ?? 0 }
      : values.pricing === "table"
        ? { type: "table" }
        : { type: "quote", choice: values.pricing }
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
  const flat = carrier !== "geliver" || pricing === "flat"
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
      <DialogContent className="sm:max-w-md">
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
          {option || carrier !== "geliver" ? null : (
            <Field label={t(`${S}.pricing`)} htmlFor="shipping-option-pricing">
              <Controller
                control={form.control}
                name="pricing"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="shipping-option-pricing" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICINGS.map((each) => (
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
              <Input
                id="shipping-option-amount"
                inputMode="decimal"
                className="w-40"
                {...form.register("amount")}
              />
            </Field>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
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
