import { useQuery } from "@tanstack/react-query"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Input } from "@qticaret/admin-ui/ui/input"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { customerGroupsQuery } from "@/features/price-lists/api/price-lists"
import type { PriceListValues } from "@/features/price-lists/form"

const TYPES = ["sale", "override"] as const
const AUDIENCES = ["everyone", "groups"] as const

function useError() {
  const { t } = useTranslation()
  const { formState } = useFormContext<PriceListValues>()
  return (name: keyof PriceListValues) => {
    const key = formState.errors[name]?.message
    return key ? t(key) : undefined
  }
}

/** Its name, and whether it is a sale (shown struck through) or a price of its own. */
export function DetailsCard() {
  const { t } = useTranslation()
  const { control, register } = useFormContext<PriceListValues>()
  const error = useError()
  return (
    <SectionCard title={t("priceLists.form.details")}>
      <div className="flex flex-col gap-5">
        <Field
          label={t("priceLists.form.title")}
          htmlFor="price-list-title"
          hint={t("priceLists.form.titleHint")}
          error={error("title")}
          required
        >
          <Input id="price-list-title" maxLength={100} {...register("title")} />
        </Field>
        <Field
          label={t("priceLists.form.description")}
          htmlFor="price-list-description"
          error={error("description")}
        >
          <Textarea id="price-list-description" rows={2} {...register("description")} />
        </Field>
        <Field label={t("priceLists.form.type")}>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <RadioGroup
                aria-label={t("priceLists.form.type")}
                value={field.value}
                onValueChange={field.onChange}
                className="grid gap-2 sm:grid-cols-2"
              >
                {TYPES.map((type) => (
                  <label
                    key={type}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                  >
                    <RadioGroupItem value={type} className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium">
                        {t(`priceLists.types.${type}`)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t(`priceLists.types.${type}Hint`)}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
        </Field>
      </div>
    </SectionCard>
  )
}

function GroupList({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation()
  const groups = useQuery(customerGroupsQuery())
  const rows = groups.data ?? []
  if (!groups.isPending && rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("priceLists.form.noGroups")}</p>
  }
  return (
    <ul
      role="group"
      aria-label={t("priceLists.form.groups")}
      data-scroll-area="y"
      className="relative flex max-h-60 flex-col gap-0.5 overflow-x-hidden overflow-y-auto rounded-md border p-1.5"
    >
      {rows.map((group) => (
        <li key={group.id}>
          <label className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted">
            <Checkbox
              checked={value.includes(group.id)}
              onCheckedChange={(checked) => {
                onChange(
                  checked === true ? [...value, group.id] : value.filter((id) => id !== group.id)
                )
              }}
            />
            {group.name}
          </label>
        </li>
      ))}
    </ul>
  )
}

/** On or off (a new list), on which days, and for everyone or some customer groups. */
export function AudienceCard({ isNew }: { isNew: boolean }) {
  const { t } = useTranslation()
  const { control, register } = useFormContext<PriceListValues>()
  const audience = useWatch<PriceListValues, "audience">({ name: "audience" })
  const error = useError()
  return (
    <SectionCard title={t("priceLists.form.when")} description={t("priceLists.form.whenHint")}>
      <div className="flex flex-col gap-5">
        {isNew ? (
          <label
            htmlFor="price-list-active"
            className="flex cursor-pointer items-start justify-between gap-4 rounded-md border px-3 py-2.5"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t("priceLists.form.active")}</span>
              <span className="text-[13px] text-muted-foreground">
                {t("priceLists.form.activeHint")}
              </span>
            </span>
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Switch
                  id="price-list-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </label>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t("priceLists.form.starts")}
            htmlFor="price-list-starts"
            hint={t("priceLists.form.startsHint")}
          >
            <Input id="price-list-starts" type="date" {...register("starts")} />
          </Field>
          <Field
            label={t("priceLists.form.ends")}
            htmlFor="price-list-ends"
            hint={t("priceLists.form.endsHint")}
            error={error("ends")}
          >
            <Input id="price-list-ends" type="date" {...register("ends")} />
          </Field>
        </div>
        <Field label={t("priceLists.form.audience")} error={error("groups")}>
          <Controller
            control={control}
            name="audience"
            render={({ field }) => (
              <RadioGroup
                aria-label={t("priceLists.form.audience")}
                value={field.value}
                onValueChange={field.onChange}
                className="grid gap-2 sm:grid-cols-2"
              >
                {AUDIENCES.map((value) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-[13px] has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                  >
                    <RadioGroupItem value={value} />
                    {t(`priceLists.audiences.${value}`)}
                  </label>
                ))}
              </RadioGroup>
            )}
          />
          {audience === "groups" ? (
            <Controller
              control={control}
              name="groups"
              render={({ field }) => <GroupList value={field.value} onChange={field.onChange} />}
            />
          ) : null}
        </Field>
      </div>
    </SectionCard>
  )
}
