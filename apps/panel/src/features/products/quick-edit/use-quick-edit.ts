import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { saveVariantEdits } from "@/features/products/api/product-edit"
import { shopDefaultsQuery } from "@/features/products/api/lookups"
import { groupReasons } from "@/features/products/bulk/bulk-delete"
import type { DeleteFailure } from "@/features/products/bulk/bulk-delete"
import { changeCount, changedFields, hasProblems, saveOf } from "./quick-drafts"
import type { QuickDraft, QuickDrafts, QuickProduct } from "./quick-drafts"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"

const Q = "products.quickEdit"

export interface QuickEdit {
  on: boolean
  setOn: (on: boolean) => void
  locationId: string | null
  drafts: QuickDrafts
  /** Types a value on a product's row; the row is kept with it. */
  set: (product: QuickProduct, field: "price" | "stock" | "status", value: string) => void
  /** Values that differ from what is stored, across every page. */
  count: number
  invalid: boolean
  saving: boolean
  save: () => void
  reset: () => void
}

/**
 * The list's quick edit: the drafts, and saving them product by product
 * (status, then the variant's price and shelf through the product page's
 * own save). What saved leaves the drafts; what the server refused stays,
 * its reasons in one message, so it can be fixed and saved again.
 */
export function useQuickEdit(): QuickEdit {
  const { t } = useTranslation()
  const client = useQueryClient()
  const defaults = useQuery(shopDefaultsQuery())
  const locationId = defaults.data?.locationId ?? null
  const [on, setOn] = useState(false)
  const [drafts, setDrafts] = useState<QuickDrafts>({})
  const [saving, setSaving] = useState(false)
  const set: QuickEdit["set"] = (product, field, value) => {
    setDrafts((was) => {
      const draft: QuickDraft = { ...(was[product.id] ?? { product }), [field]: value }
      return { ...was, [product.id]: draft }
    })
  }
  const count = changeCount(drafts, locationId)
  const saveOne = async (draft: QuickDraft) => {
    const { status, variant } = saveOf(draft, locationId)
    if (status) {
      await sdk.admin.product.update(draft.product.id, { status })
    }
    if (variant) {
      await saveVariantEdits(draft.product.id, { edits: [variant], locationId })
    }
  }
  const save = () => {
    const pending = Object.values(drafts).filter(
      (draft) => changedFields(draft, locationId).length > 0
    )
    if (pending.length === 0 || hasProblems(drafts, locationId)) {
      return
    }
    setSaving(true)
    void (async () => {
      const failed: DeleteFailure[] = []
      for (const draft of pending) {
        try {
          await saveOne(draft)
        } catch (failure) {
          failed.push({ id: draft.product.id, failure })
        }
      }
      const kept = new Set(failed.map((item) => item.id))
      setDrafts((was) => Object.fromEntries(Object.entries(was).filter(([id]) => kept.has(id))))
      setSaving(false)
      await Promise.all(
        ["products", "inventory", "dashboard", "seo"].map((key) =>
          client.invalidateQueries({ queryKey: [key] })
        )
      )
      const saved = pending.length - failed.length
      if (saved > 0) {
        toast.success(t(`${Q}.saved`, { count: saved, formatted: formatCount(saved) }))
      }
      if (failed.length > 0) {
        toast.error(
          t(`${Q}.failed`, { count: failed.length, formatted: formatCount(failed.length) }),
          {
            description: groupReasons(failed, (failure) => errorText(t, failure))
              .slice(0, 3)
              .map(({ reason, count: times }) => `${reason} (${formatCount(times)})`)
              .join(" · "),
          }
        )
      }
    })()
  }
  return {
    on,
    setOn,
    locationId,
    drafts,
    set,
    count,
    invalid: hasProblems(drafts, locationId),
    saving,
    save,
    reset: () => {
      setDrafts({})
    },
  }
}
