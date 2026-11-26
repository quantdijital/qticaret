import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { useSetSalePrices } from "@/features/products/api/sale-prices"
import { errorText } from "@/lib/errors"
import { bulkSaleChange } from "./sale-price-values"
import type { BulkSaleDraft } from "./sale-price-values"

const S = "products.sale"

/**
 * "İndirimli fiyat" for the variants the bulk bar holds: a price, a
 * percentage off, or none, with optional days. The server refuses the
 * whole change when a price is not below one variant's regular price.
 */
export function SaleBulkDialog({
  productId,
  variantIds,
  open,
  onOpenChange,
}: {
  productId: string
  variantIds: readonly string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const save = useSetSalePrices(productId)
  const [draft, setDraft] = useState<BulkSaleDraft>({
    mode: "percent",
    value: "",
    starts: "",
    ends: "",
  })
  const [error, setError] = useState<string | undefined>()
  const change = bulkSaleChange(variantIds, draft)
  const submit = () => {
    if (!change) {
      setError(t(draft.mode === "percent" ? "priceLists.errors.percent" : `${S}.errors.amount`))
      return
    }
    save.mutate(change, {
      onSuccess: () => {
        toast.success(t(`${S}.bulk.done`, { count: variantIds.length }))
        onOpenChange(false)
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(`${S}.bulk.title`)}
      description={t(`${S}.bulk.description`, { count: variantIds.length })}
      dirty={draft.mode === "clear" || draft.value.trim() !== ""}
      saving={save.isPending}
      onSubmit={submit}
      submitLabel={t(`${S}.bulk.apply`, { count: variantIds.length })}
    >
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        className="self-start"
        value={draft.mode}
        aria-label={t(`${S}.bulk.mode`)}
        onValueChange={(next) => {
          if (next === "price" || next === "percent" || next === "clear") {
            setDraft({ ...draft, mode: next, value: "" })
            setError(undefined)
          }
        }}
      >
        <ToggleGroupItem value="percent">{t(`${S}.bulk.percent`)}</ToggleGroupItem>
        <ToggleGroupItem value="price">{t(`${S}.bulk.price`)}</ToggleGroupItem>
        <ToggleGroupItem value="clear">{t(`${S}.remove`)}</ToggleGroupItem>
      </ToggleGroup>
      {draft.mode === "clear" ? null : (
        <>
          <Field
            label={t(draft.mode === "percent" ? `${S}.bulk.percentLabel` : `${S}.label`)}
            htmlFor="sale-bulk-value"
            error={error}
            hint={t(`${S}.hint`)}
          >
            <NumberField
              id="sale-bulk-value"
              decimals={2}
              min={0}
              suffix={draft.mode === "percent" ? "%" : "₺"}
              value={draft.value}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setDraft({ ...draft, value: event.target.value })
                setError(undefined)
              }}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t(`${S}.starts`)} htmlFor="sale-bulk-starts">
              <Input
                id="sale-bulk-starts"
                type="date"
                value={draft.starts}
                onChange={(event) => {
                  setDraft({ ...draft, starts: event.target.value })
                }}
              />
            </Field>
            <Field label={t(`${S}.ends`)} htmlFor="sale-bulk-ends">
              <Input
                id="sale-bulk-ends"
                type="date"
                value={draft.ends}
                onChange={(event) => {
                  setDraft({ ...draft, ends: event.target.value })
                }}
              />
            </Field>
          </div>
        </>
      )}
    </FormDialog>
  )
}

/**
 * The bulk bar's "İndirimli fiyat" (adr/0086): its dialog for the variants
 * the bar holds. One line in the bar: `<SaleBulkButton productId={…} variantIds={…} />`.
 */
export function SaleBulkButton({
  productId,
  variantIds,
}: {
  productId: string
  variantIds: readonly string[]
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={variantIds.length === 0}
        onClick={() => {
          setOpen(true)
        }}
      >
        {t(`${S}.bulk.action`)}
      </Button>
      {open ? (
        <SaleBulkDialog
          productId={productId}
          variantIds={variantIds}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  )
}
