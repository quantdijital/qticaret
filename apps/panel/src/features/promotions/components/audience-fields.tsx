import { useQuery } from "@tanstack/react-query"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { customerGroupsQuery } from "@/features/price-lists/api/price-lists"
import type { PromotionValues } from "@/features/promotions/form"
import type { Audience } from "@/features/promotions/scope"

const AUDIENCES: readonly Audience[] = ["everyone", "groups"]

function GroupList({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation()
  const groups = useQuery(customerGroupsQuery())
  const rows = groups.data ?? []
  if (!groups.isPending && rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("promotions.form.noGroups")}</p>
  }
  return (
    <ul
      role="group"
      aria-label={t("promotions.form.audienceGroups")}
      // A shop's groups can be many: they scroll in a box of fixed height (e2e/support/scroll.ts)
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

/**
 * Who may use the promotion (K1/K2): everyone or some customer groups, and
 * whether on a first order only. The backend refuses the code to anyone
 * else with why, and checks it again at the checkout.
 */
export function AudienceFields() {
  const { t } = useTranslation()
  const { control, formState } = useFormContext<PromotionValues>()
  const audience = useWatch<PromotionValues, "audience">({ name: "audience" })
  const groupsError = formState.errors.groups?.message
  return (
    <>
      <Field
        label={t("promotions.form.audience")}
        hint={t("promotions.form.audienceHint")}
        error={groupsError ? t(groupsError) : undefined}
      >
        <Controller
          control={control}
          name="audience"
          render={({ field }) => (
            <RadioGroup
              aria-label={t("promotions.form.audience")}
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
                  {t(`promotions.form.audiences.${value}`)}
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
      <label
        htmlFor="promotion-first-order"
        className="flex cursor-pointer items-start justify-between gap-4 rounded-md border px-3 py-2.5"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{t("promotions.form.firstOrder")}</span>
          <span className="text-[13px] text-muted-foreground">
            {t("promotions.form.firstOrderHint")}
          </span>
        </span>
        <Controller
          control={control}
          name="firstOrder"
          render={({ field }) => (
            <Switch
              id="promotion-first-order"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </label>
    </>
  )
}
