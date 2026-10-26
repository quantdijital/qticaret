import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { PromotionSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input"

function SwitchRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-[13px] text-muted-foreground">{hint}</span>
      </span>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  )
}

/**
 * Shop-wide promotion rules (F4.4, F4.5, ADR-0024): free shipping from a
 * basket total, given to every flat-rate shipping option, and whether a
 * cart may carry more than one code.
 */
export function PromotionSettingsCard() {
  const { t } = useTranslation()
  const section = useQuery(sectionQuery<PromotionSettings>("promotions"))
  const save = useSaveSection<PromotionSettings>("promotions")
  const stored = section.data?.values
  const [draft, setDraft] = useState<string | null>(null)
  const [on, setOn] = useState<boolean | null>(null)
  const freeOn = on ?? (stored?.free_shipping_threshold ?? null) !== null
  const text =
    draft ??
    (stored?.free_shipping_threshold ? formatMoneyInput(stored.free_shipping_threshold) : "")
  const amount = parseMoneyInput(text)
  const valid = !freeOn || (amount !== null && amount > 0)
  const changed = (freeOn ? amount : null) !== (stored?.free_shipping_threshold ?? null) && valid
  const persist = (values: Partial<PromotionSettings>, done?: () => void) => {
    save.mutate(values, {
      onSuccess: () => {
        done?.()
        toast.success(t("promotions.settings.saved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  return (
    <SectionCard title={t("promotions.settings.title")} description={t("promotions.settings.hint")}>
      {!stored ? (
        <Skeleton className="h-28" />
      ) : (
        <div className="flex flex-col gap-5">
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              persist({ free_shipping_threshold: freeOn ? amount : null }, () => {
                setDraft(null)
                setOn(null)
              })
            }}
          >
            <SwitchRow
              id="free-shipping-on"
              label={t("promotions.settings.freeShipping")}
              hint={t("promotions.settings.freeShippingHint")}
              checked={freeOn}
              disabled={save.isPending}
              onChange={setOn}
            />
            {freeOn ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="free-shipping-threshold" className="text-sm font-medium">
                    {t("promotions.settings.threshold")}
                  </label>
                  <div className="relative w-40">
                    <Input
                      id="free-shipping-threshold"
                      inputMode="decimal"
                      className="pr-8 text-right tabular-nums"
                      value={text}
                      aria-invalid={!valid || undefined}
                      onChange={(event) => {
                        setDraft(event.target.value)
                      }}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                      ₺
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
            <div>
              <Button type="submit" size="sm" disabled={!changed || save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" /> : null}
                {t("common.save")}
              </Button>
            </div>
          </form>
          <div className="border-t pt-5">
            <SwitchRow
              id="combine-codes"
              label={t("promotions.settings.combineCodes")}
              hint={t("promotions.settings.combineCodesHint")}
              checked={stored.combine_codes}
              disabled={save.isPending}
              onChange={(checked) => {
                persist({ combine_codes: checked })
              }}
            />
          </div>
        </div>
      )}
    </SectionCard>
  )
}
