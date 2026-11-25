import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useDirtyEntry } from "@qticaret/admin-ui/patterns/dirty-registry"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { salePricesQuery, useSetSalePrices } from "@/features/products/api/sale-prices"
import { errorText } from "@/lib/errors"
import { checkSale, EMPTY_SALE, saleChangeOf, saleDraftOf, sameDraft } from "./sale-price-values"
import type { SaleDraft } from "./sale-price-values"

const S = "products.sale"

/**
 * A variant's sale price beside its regular one (adr/0086), as WooCommerce
 * has it: "İndirimli fiyat", and "Zamanla" for its first and last day.
 * Saved on its own (the server checks it against the stored regular
 * price) and through the page's one save bar; the discount's share is
 * shown, and the storefront strikes through the price-before rule's
 * price, not necessarily the regular one.
 */
export function SalePriceField({
  productId,
  variantId,
  idPrefix,
}: {
  productId: string
  variantId: string
  idPrefix: string
}) {
  const { t } = useTranslation()
  const read = useQuery(salePricesQuery(productId))
  const row = read.data?.variants.find((each) => each.id === variantId)
  const stored = saleDraftOf(row?.sale)
  const [draft, setDraft] = useState<SaleDraft>(stored)
  const save = useSetSalePrices(productId)
  const dirty = !sameDraft(draft, stored)
  const regular = row?.regular === null || row?.regular === undefined ? null : Number(row.regular)
  const check = checkSale(draft, regular)
  const storedKey = JSON.stringify(stored)
  // The stored sale the draft was last in step with: a newer one (the first read, the
  // server's answer, another tab's save) replaces the field unless it was edited since
  // (adjusted while drawing, as React has a prop change followed)
  const [base, setBase] = useState(storedKey)
  if (storedKey !== base) {
    setBase(storedKey)
    if (sameDraft(draft, JSON.parse(base) as SaleDraft)) {
      setDraft(stored)
    }
  }
  const submit = () => {
    if (check.error) {
      toast.error(t(`${S}.errors.${check.error}`))
      return
    }
    save.mutate(saleChangeOf(variantId, draft), {
      onSuccess: (answer) => {
        const next = answer.variants.find((each) => each.id === variantId)
        setDraft(saleDraftOf(next?.sale))
        toast.success(t(`${S}.saved`))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  const reset = () => {
    setDraft(stored)
  }
  useDirtyEntry({ dirty, saving: save.isPending, submit, reset })
  if (!read.data) {
    return null
  }
  const update = (change: Partial<SaleDraft>) => {
    setDraft((current) => ({ ...current, ...change }))
  }
  const id = `${idPrefix}-sale`
  const sale = row?.sale
  return (
    <div className="flex flex-col gap-3" data-testid="sale-price-field">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t(`${S}.label`)}
          htmlFor={id}
          error={check.error ? t(`${S}.errors.${check.error}`) : undefined}
          hint={t(`${S}.hint`)}
        >
          <NumberField
            id={id}
            decimals={2}
            min={0}
            suffix="₺"
            placeholder="—"
            aria-invalid={Boolean(check.error)}
            value={draft.amount}
            onChange={(event) => {
              update({ amount: event.target.value })
            }}
          />
        </Field>
        {draft.scheduled ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t(`${S}.starts`)} htmlFor={`${id}-starts`}>
              <Input
                id={`${id}-starts`}
                type="date"
                value={draft.starts}
                onChange={(event) => {
                  update({ starts: event.target.value })
                }}
              />
            </Field>
            <Field label={t(`${S}.ends`)} htmlFor={`${id}-ends`}>
              <Input
                id={`${id}-ends`}
                type="date"
                value={draft.ends}
                onChange={(event) => {
                  update({ ends: event.target.value })
                }}
              />
            </Field>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {check.percent !== null ? (
          <span className="font-medium text-foreground">
            {t(`${S}.percent`, { percent: check.percent })}
          </span>
        ) : null}
        {sale && !dirty ? (
          <span>
            {sale.running
              ? sale.ends_at
                ? t(`${S}.runsUntil`, { date: formatDate(sale.ends_at) })
                : t(`${S}.running`)
              : t(`${S}.startsOn`, { date: formatDate(sale.starts_at ?? "") })}
          </span>
        ) : null}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          aria-expanded={draft.scheduled}
          onClick={() => {
            update(draft.scheduled ? { scheduled: false } : { scheduled: true })
          }}
        >
          {draft.scheduled ? t(`${S}.unschedule`) : t(`${S}.schedule`)}
        </Button>
        {sale ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => {
              update(EMPTY_SALE)
            }}
          >
            {t(`${S}.remove`)}
          </Button>
        ) : null}
      </div>
      {dirty ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={save.isPending} onClick={submit}>
            {t(`${S}.apply`)}
          </Button>
          <Button type="button" size="sm" variant="cancel" onClick={reset}>
            {t(`${S}.cancel`)}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
