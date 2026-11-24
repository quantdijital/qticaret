import { useQuery } from "@tanstack/react-query"
import { Controller, useForm, useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { PRODUCT_KINDS } from "@/features/products/api/product-edit"
import type { CatalogDefaults } from "@/features/products/wizard/catalog-defaults"
import { useFeature } from "@/features/settings/api/features"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const C = "settings.catalogDefaults"
const NON_PHYSICAL_FLAG = "catalog.non_physical"
/** The structured data a dated product's page may add (the server's closed list). */
const DATED_SCHEMA_TYPES = ["TouristTrip", "Event"] as const

interface Shown {
  kinds: boolean
  booking: boolean
}

/** Only a service is sold by date (adr/0076 §2): any other kind saves `none`. */
function toSaved(values: CatalogDefaults): CatalogDefaults {
  return values.new_product_kind === "service"
    ? values
    : { ...values, new_product_booking_mode: "none" }
}

function KindField({ form }: { form: UseFormReturn<CatalogDefaults> }) {
  const { t } = useTranslation()
  return (
    <Field
      label={t(`${C}.kind`)}
      term="new_product_kind"
      htmlFor="catalog-default-kind"
      hint={t(`${C}.kindHint`)}
    >
      <Controller
        control={form.control}
        name="new_product_kind"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id="catalog-default-kind" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {t(`products.catalog.kinds.${kind}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  )
}

function DatedField({ form }: { form: UseFormReturn<CatalogDefaults> }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <label htmlFor="catalog-default-booking" className="text-sm font-medium">
            {t(`${C}.dated`)}
          </label>
          <small className="text-[11px] text-muted-foreground">booking_mode</small>
        </div>
        <span id="catalog-default-booking-hint" className="text-[13px] text-muted-foreground">
          {t(`${C}.datedHint`)}
        </span>
      </div>
      <Controller
        control={form.control}
        name="new_product_booking_mode"
        render={({ field }) => (
          <Switch
            id="catalog-default-booking"
            aria-describedby="catalog-default-booking-hint"
            checked={field.value === "departure"}
            onCheckedChange={(checked) => {
              field.onChange(checked ? "departure" : "none")
            }}
          />
        )}
      />
    </div>
  )
}

function SchemaField({ form }: { form: UseFormReturn<CatalogDefaults> }) {
  const { t } = useTranslation()
  return (
    <Field
      label={t(`${C}.schema`)}
      term="schema.org"
      htmlFor="catalog-default-schema"
      hint={t(`${C}.schemaHint`)}
    >
      <Controller
        control={form.control}
        name="dated_schema_type"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id="catalog-default-schema" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATED_SCHEMA_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`${C}.schemas.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  )
}

function Form({ saved, shown }: { saved: CatalogDefaults; shown: Shown }) {
  const { t } = useTranslation()
  const save = useSaveSection<CatalogDefaults>("catalog")
  const form = useForm<CatalogDefaults>({
    values: saved,
    resetOptions: { keepDirtyValues: true },
  })
  const kind = useWatch({ control: form.control, name: "new_product_kind" })
  const submit = form.handleSubmit((next) => {
    save.mutate(toSaved(next), {
      onSuccess: (result) => {
        form.reset(result.values, FULL_RESET)
        toast.success(t("settings.saved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })
  return (
    <CardForm
      title={t(`${C}.title`)}
      description={t(`${C}.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      {shown.kinds ? <KindField form={form} /> : null}
      {shown.kinds && shown.booking && kind === "service" ? <DatedField form={form} /> : null}
      {shown.booking ? <SchemaField form={form} /> : null}
    </CardForm>
  )
}

/**
 * Settings > Product attributes: the shop's catalog defaults (adr/0076
 * §12, D8). What a new product starts as in the wizard, and the structured
 * data a dated product's page adds. Each field shows only while its flag
 * lets it count: the kind with `catalog.non_physical`, selling by date and
 * the structured data with `catalog.booking`; with neither, no card.
 */
export function CatalogDefaultsCard() {
  const kinds = useFeature(NON_PHYSICAL_FLAG)
  const booking = useFeature(BOOKING_FLAG)
  const on = kinds || booking
  const query = useQuery({ ...sectionQuery<CatalogDefaults>("catalog"), enabled: on })
  if (!on) {
    return null
  }
  return query.data ? (
    <Form saved={query.data.values} shown={{ kinds, booking }} />
  ) : (
    <Skeleton className="h-48 rounded-lg" />
  )
}
