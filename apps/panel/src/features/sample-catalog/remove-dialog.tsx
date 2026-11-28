import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DialogHeading } from "@qticaret/admin-ui/patterns/dialog-heading"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@qticaret/admin-ui/ui/dialog"
import { SAMPLE_PARTS, removalPreviewQuery, useRemoveSamples } from "@/features/sample-catalog/api"
import type { RemovalPlan, SamplePart, SampleProduct } from "@/features/sample-catalog/api"
import { KeepList, RemovalParts, Stays } from "@/features/sample-catalog/remove-parts"
import { errorText } from "@/lib/errors"

const R = "sampleCatalog.remove"

const removable = (products: readonly SampleProduct[]) =>
  new Set(products.filter((product) => product.blocked === null).map((product) => product.id))

/** What the removal did, said in the dialog: counts, what was hidden again, what stayed and why. */
function RemovalReport({ result, onClose }: { result: RemovalPlan; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <DialogHeading title={t(`${R}.doneTitle`)} />
      <DialogBody>
        <p className="text-sm">
          {t(`${R}.done`, {
            products: result.products,
            categories: result.categories,
            reviews: result.reviews,
          })}
        </p>
        {result.categories_hidden > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(`${R}.hidden`, { count: result.categories_hidden })}
          </p>
        ) : null}
        <Stays plan={result} />
      </DialogBody>
      <DialogFooter>
        <Button type="button" onClick={onClose}>
          {t("common.close")}
        </Button>
      </DialogFooter>
    </>
  )
}

/**
 * "Örnek içeriği kaldır" (owner, 2026-11-28): the parts to remove, each
 * with its count from a dry run; the products kept one by one under
 * "Bazılarını tut"; what stays and why. The confirmation is the red
 * button, "Vazgeç" red words; the report follows in the same dialog.
 */
export function RemoveSamplesDialog({
  products,
  onClose,
}: {
  products: readonly SampleProduct[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [parts, setParts] = useState<Set<SamplePart>>(() => new Set(SAMPLE_PARTS))
  const [going, setGoing] = useState<Set<string>>(() => removable(products))
  const [result, setResult] = useState<RemovalPlan | null>(null)
  const remove = useRemoveSamples()
  // One an order holds is never sent as kept: the plan names it, with its reason
  const keep = products
    .filter((product) => product.blocked === null && !going.has(product.id))
    .map((product) => product.id)
  const choice = { parts: SAMPLE_PARTS.filter((part) => parts.has(part)), keep_product_ids: keep }
  const chosen = useQuery(removalPreviewQuery(choice, result === null))
  const whole = useQuery(
    removalPreviewQuery({ parts: [...SAMPLE_PARTS], keep_product_ids: keep }, result === null)
  )
  const plan = chosen.data
  const nothing =
    plan !== undefined &&
    plan.products + plan.categories + plan.reviews + plan.categories_hidden === 0
  const close = () => {
    if (!remove.isPending) {
      onClose()
    }
  }
  const confirm = () => {
    remove.mutate(choice, {
      onSuccess: setResult,
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          close()
        }
      }}
    >
      <DialogContent size="md" pane>
        {result ? (
          <RemovalReport result={result} onClose={onClose} />
        ) : (
          <>
            <DialogHeading title={t(`${R}.title`)} description={t(`${R}.description`)} />
            <DialogBody>
              <RemovalParts parts={parts} onParts={setParts} chosen={plan} whole={whole.data} />
              {parts.has("products") && products.length > 0 ? (
                <KeepList products={products} going={going} onGoing={setGoing} />
              ) : null}
              {plan ? <Stays plan={plan} /> : null}
              {nothing ? (
                <p className="text-sm text-muted-foreground">{t(`${R}.nothing`)}</p>
              ) : null}
              {chosen.isError ? (
                <p className="text-sm text-destructive-text">{errorText(t, chosen.error)}</p>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="cancel" disabled={remove.isPending} onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={remove.isPending || choice.parts.length === 0 || !plan || nothing}
                onClick={confirm}
              >
                {remove.isPending ? <Loader2 className="animate-spin" /> : null}
                {t(`${R}.confirm`)}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
