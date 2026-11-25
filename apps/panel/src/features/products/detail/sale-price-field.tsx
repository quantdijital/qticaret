import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { EMPTY_SALE } from "./sale-price-values"
import { useVariantSale } from "./use-variant-sale"
import type { SaleTarget, VariantSale } from "./use-variant-sale"

const S = "products.sale"

/**
 * A variant's sale price beside its regular one (adr/0086), as WooCommerce
 * has it: "İndirimli fiyat", and "Zamanla" for its first and last day.
 * The discount's share is shown; the storefront strikes through the
 * price-before rule's price, not necessarily the regular one. `own`: its
 * own "İndirimi kaydet" (a host that saves it with its form has none).
 */
export function SalePriceView({
  sale,
  idPrefix,
  own,
}: {
  sale: VariantSale
  idPrefix: string
  own: boolean
}) {
  const { t } = useTranslation()
  if (!sale.ready) {
    return null
  }
  const { draft, update, check, stored, dirty } = sale
  const id = `${idPrefix}-sale`
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
        {stored && !dirty ? (
          <span>
            {stored.running
              ? stored.ends_at
                ? t(`${S}.runsUntil`, { date: formatDate(stored.ends_at) })
                : t(`${S}.running`)
              : t(`${S}.startsOn`, { date: formatDate(stored.starts_at ?? "") })}
          </span>
        ) : null}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          aria-expanded={draft.scheduled}
          onClick={() => {
            update({ scheduled: !draft.scheduled })
          }}
        >
          {draft.scheduled ? t(`${S}.unschedule`) : t(`${S}.schedule`)}
        </Button>
        {stored ? (
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
      {own && dirty ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={sale.saving} onClick={sale.submit}>
            {t(`${S}.apply`)}
          </Button>
          <Button type="button" size="sm" variant="cancel" onClick={sale.reset}>
            {t(`${S}.cancel`)}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * The field on its own: saved by its "İndirimi kaydet" and through the
 * page's one save bar (the variant's dialog, the one-variant card).
 */
export function SalePriceField({
  productId,
  variantId,
  idPrefix,
}: SaleTarget & { idPrefix: string }) {
  const sale = useVariantSale({ productId, variantId }, true)
  return <SalePriceView sale={sale} idPrefix={idPrefix} own />
}
