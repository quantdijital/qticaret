import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { formatMoneyInput, parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import type { CollapseOptions } from "@qticaret/admin-ui/patterns/collapsible-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useSaveSection } from "@/features/settings/api/sections"
import type { ShippingSettings } from "@/features/settings/api/sections"
import {
  SHIPPING_CLASS_USAGE_KEY,
  newClassKey,
  shippingClassUsageQuery,
} from "@/features/settings/api/shipping-classes"
import { errorText } from "@/lib/errors"

const S = "settings.shipping.classes"
const MAX_CLASSES = 20
// 100.000 TL, as the server takes it
const MAX_SURCHARGE = 100_000

const schema = z.object({
  rows: z
    .array(
      z.object({
        key: z.string(),
        name: z.string().trim().min(1, `${S}.nameInvalid`).max(60, `${S}.nameInvalid`),
        surcharge: z.string().refine((text) => {
          const amount = parseMoneyInput(text) ?? -1
          return amount >= 0 && amount <= MAX_SURCHARGE
        }, `${S}.surchargeInvalid`),
      })
    )
    .max(MAX_CLASSES),
})
type Values = z.infer<typeof schema>

const valuesOf = (saved: ShippingSettings): Values => ({
  rows: (saved.shipping_classes ?? []).map((each) => ({
    key: each.key,
    name: each.name,
    surcharge: formatMoneyInput(each.surcharge / 100),
  })),
})

/**
 * Settings > Shipping > Gelişmiş > "Kargo sınıfları" (adr/0087 §4): the
 * shop's own surcharge classes edited in place, no dialog. The built-in
 * free class is not a row (the owner, 2026-11-26: a locked row said
 * nothing): a product's "Bu ürünün kargosu ücretsiz" switch is it. A class
 * some products use asks before it goes, in its row: those products count
 * as Standard (a warning, not a stop).
 */
export function ShippingClassesCard({
  saved,
  collapse,
}: {
  saved: ShippingSettings
  collapse?: CollapseOptions | undefined
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const save = useSaveSection<ShippingSettings>("shipping")
  const usage = useQuery(shippingClassUsageQuery()).data ?? {}
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const rows = useFieldArray({ control: form.control, name: "rows" })
  // `useWatch`, not `form.watch()`: the React Compiler can follow it
  const names = useWatch({ control: form.control, name: "rows" })
  const [asking, setAsking] = useState<string | null>(null)
  const { errors } = form.formState
  const productsText = (key: string) => {
    const count = usage[key] ?? 0
    return count > 0 ? t(`${S}.products`, { count }) : t(`${S}.noProducts`)
  }

  const submit = form.handleSubmit((next) => {
    save.mutate(
      {
        shipping_classes: next.rows.map((row) => ({
          key: row.key,
          name: row.name.trim(),
          surcharge: Math.round((parseMoneyInput(row.surcharge) ?? 0) * 100),
        })),
      },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.values), FULL_RESET)
          setAsking(null)
          void client.invalidateQueries({ queryKey: SHIPPING_CLASS_USAGE_KEY })
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })

  return (
    <CardForm
      title={t(`${S}.title`)}
      description={t(`${S}.description`)}
      collapse={collapse}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
        setAsking(null)
      }}
    >
      {rows.fields.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t(`${S}.empty`)}</p>
      ) : null}
      <ul
        className="flex flex-col divide-y rounded-md border empty:hidden"
        data-testid="shipping-classes"
      >
        {rows.fields.map((row, index) => {
          const used = usage[row.key] ?? 0
          const typed = names[index]?.name ?? ""
          const name = typed.trim() === "" ? t(`${S}.name`) : typed
          const message =
            errors.rows?.[index]?.name?.message ?? errors.rows?.[index]?.surcharge?.message
          return (
            <li key={row.id} className="flex flex-col gap-2 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Input
                  aria-label={t(`${S}.nameOf`, { number: index + 1 })}
                  aria-invalid={Boolean(errors.rows?.[index]?.name)}
                  maxLength={60}
                  placeholder={t(`${S}.namePlaceholder`)}
                  className="min-w-0 flex-[1_1_12rem]"
                  {...form.register(`rows.${index}.name`)}
                />
                <NumberField
                  decimals={2}
                  min={0}
                  suffix="₺"
                  aria-label={t(`${S}.surchargeOf`, { number: index + 1 })}
                  aria-invalid={Boolean(errors.rows?.[index]?.surcharge)}
                  className="w-40"
                  {...form.register(`rows.${index}.surcharge`)}
                />
                <span className="w-24 text-[13px] text-muted-foreground">
                  {productsText(row.key)}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t(`${S}.remove`, { name })}
                  onClick={() => {
                    if (used > 0) {
                      setAsking(row.key)
                    } else {
                      rows.remove(index)
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
              {asking === row.key ? (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground"
                >
                  {t(`${S}.removeUsed`, { count: used })}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      rows.remove(index)
                      setAsking(null)
                    }}
                  >
                    {t(`${S}.removeConfirm`)}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="cancel"
                    onClick={() => {
                      setAsking(null)
                    }}
                  >
                    {t(`${S}.keep`)}
                  </Button>
                </div>
              ) : null}
              {message ? <p className="text-[13px] text-destructive">{t(message)}</p> : null}
            </li>
          )
        })}
      </ul>
      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={rows.fields.length >= MAX_CLASSES}
          onClick={() => {
            rows.append({
              key: newClassKey(form.getValues("rows").map((each) => each.key)),
              name: "",
              surcharge: formatMoneyInput(0),
            })
          }}
        >
          <Plus />
          {t(`${S}.add`)}
        </Button>
      </div>
    </CardForm>
  )
}
