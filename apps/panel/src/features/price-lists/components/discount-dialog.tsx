import { useQuery } from "@tanstack/react-query"
import { Loader2, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import { SearchPicker } from "@/components/patterns/search-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useDiscountListProducts } from "@/features/price-lists/api/price-lists"
import { percentOf } from "@/features/price-lists/form"
import { productNamesQuery, searchProducts } from "@/features/promotions/api/scope-options"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"

function PickedProducts({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation()
  const names = useQuery(productNamesQuery(ids))
  const nameOf = (id: string) => names.data?.find((product) => product.id === id)?.title ?? id
  return (
    <div className="flex flex-col gap-3">
      <SearchPicker
        value={null}
        onChange={(picked) => {
          if (picked && !ids.includes(picked.id)) {
            onChange([...ids, picked.id])
          }
        }}
        search={searchProducts}
        queryKey={["price-lists", "product-search"]}
        placeholder={t("priceLists.discount.addProduct")}
        empty={t("priceLists.discount.noProducts")}
      />
      {ids.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {ids.map((id) => (
            <li
              key={id}
              className="flex items-center gap-1 rounded-md border bg-muted/40 py-1 pr-1 pl-2.5 text-[13px]"
            >
              {nameOf(id)}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={t("priceLists.discount.removeProduct", { name: nameOf(id) })}
                onClick={() => {
                  onChange(ids.filter((each) => each !== id))
                }}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

interface DiscountDialogProps {
  listId: string
  /** The list's own products (a new percentage for all of them); null to pick products to add. */
  products: string[] | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Products into the list at their own price less a percentage (F4.1). The
 * amounts are worked out on the server to the kuruş; a variant with no
 * price of its own is left out and said so.
 */
export function DiscountDialog({ listId, products, open, onOpenChange }: DiscountDialogProps) {
  const { t } = useTranslation()
  const discount = useDiscountListProducts(listId)
  const [picked, setPicked] = useState<string[]>([])
  const [text, setText] = useState("")
  const [error, setError] = useState<string | undefined>()
  const ids = products ?? picked

  const close = () => {
    onOpenChange(false)
    setPicked([])
    setText("")
    setError(undefined)
  }
  const apply = () => {
    const percent = percentOf(text)
    if (percent === null) {
      setError(t("priceLists.errors.percent"))
      return
    }
    discount.mutate(
      // For the list's own products: their lines only, none taken out comes back
      { productIds: ids, percent, onlyListed: products !== null },
      {
        onSuccess: (result) => {
          toast.success(t("priceLists.discount.done", { count: result.priced }))
          if (result.skipped.length > 0) {
            toast.warning(t("priceLists.discount.skipped", { count: result.skipped.length }))
          }
          close()
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t(products ? "priceLists.discount.allTitle" : "priceLists.discount.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("priceLists.discount.hint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {products ? null : <PickedProducts ids={picked} onChange={setPicked} />}
          <Field
            label={t("priceLists.discount.percent")}
            htmlFor="price-list-percent"
            error={error}
          >
            <div className="relative w-32">
              <Input
                id="price-list-percent"
                inputMode="decimal"
                className="pr-8 text-right tabular-nums"
                value={text}
                onChange={(event) => {
                  setText(event.target.value)
                  setError(undefined)
                }}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button disabled={discount.isPending || ids.length === 0} onClick={apply}>
            {discount.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("priceLists.discount.apply", {
              count: ids.length,
              formatted: formatCount(ids.length),
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
