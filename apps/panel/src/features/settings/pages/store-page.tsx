import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { StoreSettings } from "@/features/settings/api/sections"
import { storeQuery, useRenameStore } from "@/features/settings/api/store"
import { errorText } from "@/lib/errors"

// The zones a Turkish shop meets first; the browser knows the rest
const PREFERRED_ZONES = [
  "Europe/Istanbul",
  "Europe/Berlin",
  "Europe/London",
  "Asia/Baku",
  "Europe/Nicosia",
]

function zones(): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []
  return [...PREFERRED_ZONES, ...all.filter((zone) => !PREFERRED_ZONES.includes(zone))]
}

interface IdentityValues {
  name: string
  contact_email: string
  contact_phone: string
}

function IdentityCard({
  storeId,
  name,
  saved,
}: {
  storeId: string
  name: string
  saved: StoreSettings
}) {
  const { t } = useTranslation()
  const rename = useRenameStore()
  const save = useSaveSection<StoreSettings>("store")
  const values: IdentityValues = {
    name,
    contact_email: saved.contact_email ?? "",
    contact_phone: saved.contact_phone ?? "",
  }
  const form = useForm<IdentityValues>({ values, resetOptions: { keepDirtyValues: true } })
  const { dirtyFields, errors } = form.formState

  const submit = form.handleSubmit(async (next) => {
    try {
      if (dirtyFields.name) {
        await rename.mutateAsync({ id: storeId, name: next.name.trim() })
      }
      if (dirtyFields.contact_email || dirtyFields.contact_phone) {
        await save.mutateAsync({
          contact_email: next.contact_email.trim() || null,
          contact_phone: next.contact_phone.trim() || null,
        })
      }
      toast.success(t("settings.saved"))
    } catch (failure) {
      toast.error(errorText(t, failure))
    }
  })

  return (
    <CardForm
      title={t("settings.store.identity")}
      description={t("settings.store.identityHint")}
      dirty={form.formState.isDirty}
      saving={rename.isPending || save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values)
      }}
    >
      <Field
        label={t("settings.store.name")}
        htmlFor="store-name"
        required
        error={errors.name ? t("settings.store.nameRequired") : undefined}
      >
        <Input
          id="store-name"
          {...form.register("name", { validate: (text) => text.trim().length > 0 })}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("settings.store.email")}
          htmlFor="store-email"
          hint={t("settings.store.emailHint")}
        >
          <Input
            id="store-email"
            type="email"
            autoComplete="off"
            {...form.register("contact_email")}
          />
        </Field>
        <Field
          label={t("settings.store.phone")}
          htmlFor="store-phone"
          hint={t("settings.store.phoneHint")}
        >
          <Input
            id="store-phone"
            type="tel"
            placeholder="0532 123 45 67"
            {...form.register("contact_phone")}
          />
        </Field>
      </div>
    </CardForm>
  )
}

type UnitValues = Pick<StoreSettings, "timezone" | "weight_unit" | "dimension_unit">

function UnitChoice<K extends "weight_unit" | "dimension_unit">({
  name,
  options,
  control,
}: {
  name: K
  options: readonly UnitValues[K][]
  control: ReturnType<typeof useForm<UnitValues>>["control"]
}) {
  const { t } = useTranslation()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <RadioGroup
          value={field.value}
          onValueChange={field.onChange}
          className="flex flex-wrap gap-2"
        >
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
            >
              <RadioGroupItem value={option} />
              {t(`settings.store.units.${option}`)}
            </label>
          ))}
        </RadioGroup>
      )}
    />
  )
}

function RegionCard({ saved }: { saved: StoreSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<StoreSettings>("store")
  const zoneList = useMemo(() => zones(), [])
  const values: UnitValues = {
    timezone: saved.timezone,
    weight_unit: saved.weight_unit,
    dimension_unit: saved.dimension_unit,
  }
  const form = useForm<UnitValues>({ values, resetOptions: { keepDirtyValues: true } })

  const submit = form.handleSubmit((next) => {
    save.mutate(next, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })

  return (
    <CardForm
      title={t("settings.store.region")}
      description={t("settings.store.regionHint")}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values)
      }}
    >
      <Field label={t("settings.store.timezone")} htmlFor="store-timezone">
        <Controller
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="store-timezone" className="w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {zoneList.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label={t("settings.store.weightUnit")}>
        <UnitChoice name="weight_unit" options={["g", "kg"] as const} control={form.control} />
      </Field>
      <Field label={t("settings.store.dimensionUnit")} hint={t("settings.store.unitsHint")}>
        <UnitChoice name="dimension_unit" options={["cm", "mm"] as const} control={form.control} />
      </Field>
    </CardForm>
  )
}

/** Settings > Store: the shop's name and contact, its time zone and units. */
export function StorePage() {
  const { t } = useTranslation()
  const store = useQuery(storeQuery())
  const section = useQuery(sectionQuery<StoreSettings>("store"))
  const failed = store.error ?? section.error
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("settings.store.title")} description={t("settings.store.subtitle")} />
      {failed ? (
        <ErrorState
          text={errorText(t, failed)}
          onRetry={() => {
            void store.refetch()
            void section.refetch()
          }}
        />
      ) : !store.data || !section.data ? (
        <LoadingRows rows={5} />
      ) : (
        <>
          <IdentityCard
            storeId={store.data.id}
            name={store.data.name}
            saved={section.data.values}
          />
          <RegionCard saved={section.data.values} />
        </>
      )}
    </div>
  )
}
