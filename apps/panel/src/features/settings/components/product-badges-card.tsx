import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import {
  BEST_SELLER_MIN_MAX,
  NEW_DAYS_MAX,
  productBadgesQuery,
} from "@/features/settings/api/product-badges"
import type { ProductBadgeSettings } from "@/features/settings/api/product-badges"
import { useSaveSection } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const B = "products.badges"

// A whole number from 1 to `max`, as the field hands it over
const whole = (max: number) =>
  z
    .string()
    .trim()
    .refine((text) => /^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= max, {
      message: `${B}.numberInvalid`,
    })
const schema = z.object({
  manual_enabled: z.boolean(),
  best_seller_enabled: z.boolean(),
  best_seller_min_units: whole(BEST_SELLER_MIN_MAX),
  new_enabled: z.boolean(),
  new_days: whole(NEW_DAYS_MAX),
})
type Values = z.infer<typeof schema>
type SwitchName = "manual_enabled" | "best_seller_enabled" | "new_enabled"
type NumberName = "best_seller_min_units" | "new_days"

const valuesOf = (saved: ProductBadgeSettings): Values => ({
  manual_enabled: saved.manual_enabled,
  best_seller_enabled: saved.best_seller_enabled,
  best_seller_min_units: String(saved.best_seller_min_units),
  new_enabled: saved.new_enabled,
  new_days: String(saved.new_days),
})

/** A badge's switch and, while it is on, its one number. */
function BadgeSwitch({
  form,
  name,
  label,
  number,
}: {
  form: UseFormReturn<Values>
  name: SwitchName
  label: "manual" | "bestSeller" | "new"
  number?: { name: NumberName; label: "bestSellerMin" | "newDays"; max: number }
}) {
  const { t } = useTranslation()
  const on = useWatch({ control: form.control, name })
  const id = `product-badges-${name}`
  const error = number ? form.formState.errors[number.name]?.message : undefined
  return (
    <div className="flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor={id} className="text-sm font-medium">
            {t(`${B}.${label}`)}
          </label>
          <span id={`${id}-hint`} className="text-[13px] text-muted-foreground">
            {t(`${B}.${label}Hint`)}
          </span>
        </div>
        <Switch
          id={id}
          aria-describedby={`${id}-hint`}
          checked={on}
          onCheckedChange={(checked) => {
            form.setValue(name, checked, { shouldDirty: true })
          }}
        />
      </div>
      {on && number ? (
        <Field
          label={t(`${B}.${number.label}`)}
          htmlFor={`product-badges-${number.name}`}
          error={error ? t(error) : undefined}
        >
          <NumberField
            id={`product-badges-${number.name}`}
            className="w-40"
            min={1}
            max={number.max}
            aria-invalid={Boolean(error)}
            {...form.register(number.name)}
          />
        </Field>
      ) : null}
    </div>
  )
}

function Form({ saved }: { saved: ProductBadgeSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<ProductBadgeSettings>("product_badges")
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const submit = form.handleSubmit((next) => {
    save.mutate(
      {
        ...next,
        best_seller_min_units: Number(next.best_seller_min_units),
        new_days: Number(next.new_days),
      },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.values), FULL_RESET)
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${B}.title`)}
      description={t(`${B}.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <BadgeSwitch form={form} name="manual_enabled" label="manual" />
      <BadgeSwitch
        form={form}
        name="best_seller_enabled"
        label="bestSeller"
        number={{ name: "best_seller_min_units", label: "bestSellerMin", max: BEST_SELLER_MIN_MAX }}
      />
      <BadgeSwitch
        form={form}
        name="new_enabled"
        label="new"
        number={{ name: "new_days", label: "newDays", max: NEW_DAYS_MAX }}
      />
    </CardForm>
  )
}

/**
 * Settings > Product attributes: the small badge on a product card's
 * photo (the owner, 2026-11-24), each kind turned on here, all off at
 * first. In the order a card picks them: the product's own line, "Çok
 * satan", "Yeni".
 */
export function ProductBadgesCard() {
  const query = useQuery(productBadgesQuery())
  // An answer that is not the section (a backend before it) leaves the page's other cards be
  const saved = query.data?.values as Partial<ProductBadgeSettings> | undefined
  return typeof saved?.manual_enabled === "boolean" ? (
    <Form saved={saved as ProductBadgeSettings} />
  ) : (
    <Skeleton className="h-48 rounded-lg" />
  )
}
