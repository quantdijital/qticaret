import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useDirtyEntry } from "@qticaret/admin-ui/patterns/dirty-registry"
import { salePricesQuery, useSetSalePrices } from "@/features/products/api/sale-prices"
import type { VariantSaleView } from "@/features/products/api/sale-prices"
import { errorText } from "@/lib/errors"
import { checkSale, saleChangeOf, saleDraftOf, sameDraft } from "./sale-price-values"
import type { SaleCheck, SaleDraft } from "./sale-price-values"

const S = "products.sale"

/** A saved variant whose sale price (adr/0086) is edited. */
export interface SaleTarget {
  productId: string
  variantId: string
}

/** A variant's sale price being edited: what the field draws and its host saves. */
export interface VariantSale {
  /** The stored sale has been read: the field can be drawn. */
  ready: boolean
  draft: SaleDraft
  update: (change: Partial<SaleDraft>) => void
  /** The stored sale, running or to come; null: none. */
  stored: VariantSaleView | null
  check: SaleCheck
  dirty: boolean
  saving: boolean
  /** Saves it (the server checks it again); a refused one is said in a toast. */
  submit: () => void
  reset: () => void
}

/**
 * A variant's "İndirimli fiyat" as a draft beside its read (adr/0086).
 * `register`: the page's save bar knows it on its own; a host that saves
 * it with its own form (a variant's row, a simple product's tabs) says no
 * and counts it in its own entry. With no target, an empty, idle draft.
 */
export function useVariantSale(target: SaleTarget | null, register: boolean): VariantSale {
  const { t } = useTranslation()
  const productId = target?.productId ?? ""
  const variantId = target?.variantId ?? ""
  const read = useQuery({ ...salePricesQuery(productId), enabled: target !== null })
  const row = read.data?.variants.find((each) => each.id === variantId)
  const storedDraft = saleDraftOf(row?.sale)
  const [draft, setDraft] = useState<SaleDraft>(storedDraft)
  const save = useSetSalePrices(productId)
  const dirty = target !== null && !sameDraft(draft, storedDraft)
  const regular = row?.regular === null || row?.regular === undefined ? null : Number(row.regular)
  const check = checkSale(draft, regular)
  const storedKey = JSON.stringify(storedDraft)
  // The stored sale the draft was last in step with: a newer one (the first read, the
  // server's answer, another tab's save) replaces the field unless it was edited since
  // (adjusted while drawing, as React has a prop change followed)
  const [base, setBase] = useState(storedKey)
  if (storedKey !== base) {
    setBase(storedKey)
    if (sameDraft(draft, JSON.parse(base) as SaleDraft)) {
      setDraft(storedDraft)
    }
  }
  const submit = () => {
    if (!dirty) {
      return
    }
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
    setDraft(storedDraft)
  }
  useDirtyEntry({
    dirty: register && dirty,
    saving: register && save.isPending,
    submit,
    reset,
  })
  return {
    ready: Boolean(read.data),
    draft,
    update: (change) => {
      setDraft((current) => ({ ...current, ...change }))
    },
    stored: row?.sale ?? null,
    check,
    dirty,
    saving: save.isPending,
    submit,
    reset,
  }
}
