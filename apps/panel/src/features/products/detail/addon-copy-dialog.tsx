import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SearchPicker } from "@qticaret/admin-ui/patterns/search-picker"
import type { PickerOption } from "@qticaret/admin-ui/patterns/search-picker"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody, DialogSection } from "@qticaret/admin-ui/ui/dialog"
import { productCatalogQuery } from "@/features/products/api/product-edit"
import { searchProducts } from "@/features/promotions/api/scope-options"
import { errorText } from "@/lib/errors"
import type { AddonsFailure } from "./addon-failure"
import { AddonNotice } from "./addon-notice"
import { AddonRow } from "./addon-row"
import { copyOf } from "./addon-values"
import type { AddonValue } from "./addon-values"

const C = "products.addons.copy"
const noop = () => undefined

interface AddonCopyDialogProps {
  /** The product copied into: left out of the search. */
  productId: string
  /** How many add-ons it has now: any, and copying replaces them, asked first. */
  current: number
  saving: boolean
  failure: AddonsFailure | null
  onClose: () => void
  /** Saves these as the product's whole list; the server checks them as any save. */
  onCopy: (values: AddonValue[]) => void
}

/**
 * "Başka üründen kopyala": another product's add-ons as this one's, the
 * same names, prices and rules under new ids. Picking a product shows
 * what comes; when this product has add-ons of its own, replacing them
 * is asked first.
 */
export function AddonCopyDialog({
  productId,
  current,
  saving,
  failure,
  onClose,
  onCopy,
}: AddonCopyDialogProps) {
  const { t } = useTranslation()
  const [source, setSource] = useState<PickerOption | null>(null)
  const [asking, setAsking] = useState(false)
  const catalog = useQuery({
    ...productCatalogQuery(source?.id ?? ""),
    enabled: source !== null,
  })
  const addons = source ? catalog.data?.addons : undefined
  const values = (addons ?? []).map(copyOf)
  const copy = () => {
    if (current > 0) {
      setAsking(true)
    } else {
      onCopy(values)
    }
  }
  return (
    <>
      <DetailDialog
        open
        onOpenChange={(open) => {
          if (!open && !saving) {
            onClose()
          }
        }}
        title={t(`${C}.title`)}
        description={t(`${C}.description`)}
        footer={
          <>
            <Button type="button" variant="cancel" disabled={saving} onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={values.length === 0 || saving} onClick={copy}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {t(`${C}.submit`)}
            </Button>
          </>
        }
      >
        <DialogBody list>
          <Field label={t(`${C}.product`)} htmlFor="addon-copy-product">
            <SearchPicker
              id="addon-copy-product"
              value={source}
              onChange={setSource}
              search={async (q) =>
                (await searchProducts(q)).filter((option) => option.id !== productId)
              }
              queryKey={["products", "addon-copy-search", productId]}
              placeholder={t(`${C}.placeholder`)}
              empty={t(`${C}.noProducts`)}
              className="sm:max-w-none"
            />
          </Field>
          {source === null ? null : catalog.isError ? (
            <ErrorState text={errorText(t, catalog.error)} onRetry={() => void catalog.refetch()} />
          ) : !addons ? (
            <LoadingRows rows={2} />
          ) : addons.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
              {t(`${C}.none`)}
            </p>
          ) : (
            <DialogSection
              title={t(`${C}.coming`)}
              description={current > 0 ? t(`${C}.replaces`, { current }) : undefined}
            >
              <ol className="flex flex-col divide-y rounded-md border">
                {values.map((value, index) => (
                  <AddonRow
                    key={`${value.label}-${String(index)}`}
                    value={value}
                    index={index}
                    count={values.length}
                    readOnly
                    onMove={noop}
                    onEdit={noop}
                    onRemove={noop}
                  />
                ))}
              </ol>
            </DialogSection>
          )}
          {failure ? <AddonNotice tone="danger" {...failure} /> : null}
        </DialogBody>
      </DetailDialog>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${C}.replaceTitle`)}
        description={t(`${C}.replaceText`, {
          current,
          copied: values.length,
          name: source?.label ?? "",
        })}
        confirmLabel={t(`${C}.replace`)}
        destructive
        onConfirm={() => {
          setAsking(false)
          onCopy(values)
        }}
      />
    </>
  )
}
