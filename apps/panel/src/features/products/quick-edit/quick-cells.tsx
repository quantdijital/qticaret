import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { draftProblems, shelfOf, soleVariant, storedValues } from "./quick-drafts"
import type { QuickProduct } from "./quick-drafts"
import type { QuickEdit } from "./use-quick-edit"

const Q = "products.quickEdit"

// A click in a cell's field stays there: the row itself opens the product
const stay = (event: { stopPropagation: () => void }) => {
  event.stopPropagation()
}

/** A product of several variants: its range, and a link to edit them on its page. */
function OnItsPage({ product, children }: { product: QuickProduct; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-end">
      {children}
      <Link
        to="/products/$id"
        params={{ id: product.id }}
        className="text-xs text-muted-foreground underline hover:text-foreground"
        onClick={stay}
      >
        {t(`${Q}.inVariants`)}
      </Link>
    </div>
  )
}

/** The price cell: a field for a product of one variant. */
export function QuickPrice({
  product,
  edit,
  fallback,
}: {
  product: QuickProduct
  edit: QuickEdit
  /** What the list shows otherwise: the range of a product of several. */
  fallback: ReactNode
}) {
  const { t } = useTranslation()
  if (!soleVariant(product)) {
    return (product.variants ?? []).length > 1 ? (
      <OnItsPage product={product}>{fallback}</OnItsPage>
    ) : (
      fallback
    )
  }
  const draft = edit.drafts[product.id]
  const stored = storedValues(product, edit.locationId).price
  const text = draft?.price ?? stored
  const invalid = draft ? draftProblems(draft, edit.locationId).price : false
  return (
    <NumberField
      size="compact"
      decimals={2}
      min={0}
      suffix="₺"
      value={text}
      disabled={edit.saving}
      aria-label={t(`${Q}.priceOf`, { title: product.title })}
      aria-invalid={invalid || undefined}
      className={cn("ml-auto w-32", text !== stored && "border-primary")}
      onClick={stay}
      onChange={(event) => {
        edit.set(product, "price", event.target.value)
      }}
    />
  )
}

/** The stock cell: the shelf at the shop's location, "Takip yok" for stock not counted. */
export function QuickStock({
  product,
  edit,
  fallback,
}: {
  product: QuickProduct
  edit: QuickEdit
  fallback: ReactNode
}) {
  const { t } = useTranslation()
  const variant = soleVariant(product)
  if (!variant) {
    return (product.variants ?? []).length > 1 ? (
      <OnItsPage product={product}>{fallback}</OnItsPage>
    ) : (
      fallback
    )
  }
  if (!variant.manage_inventory) {
    // Not counted: it always sells (platform rule), nothing to type
    return (
      <span className="text-muted-foreground" title={t(`${Q}.untrackedHint`)}>
        {t(`${Q}.untracked`)}
      </span>
    )
  }
  if (!shelfOf(product, edit.locationId)) {
    return fallback
  }
  const draft = edit.drafts[product.id]
  const stored = storedValues(product, edit.locationId).stock
  const text = draft?.stock ?? stored
  const invalid = draft ? draftProblems(draft, edit.locationId).stock : false
  return (
    <NumberField
      size="compact"
      min={0}
      value={text}
      disabled={edit.saving}
      aria-label={t(`${Q}.stockOf`, { title: product.title })}
      aria-invalid={invalid || undefined}
      className={cn("w-24", text !== stored && "border-primary")}
      onClick={stay}
      onChange={(event) => {
        edit.set(product, "stock", event.target.value.trim())
      }}
    />
  )
}

/** The status cell: published or draft; any other status is only shown. */
export function QuickStatusCell({
  product,
  edit,
  fallback,
}: {
  product: QuickProduct
  edit: QuickEdit
  fallback: ReactNode
}) {
  const { t } = useTranslation()
  if (product.status !== "published" && product.status !== "draft") {
    return fallback
  }
  const value = edit.drafts[product.id]?.status ?? product.status
  return (
    <div onClick={stay}>
      <Select
        value={value}
        disabled={edit.saving}
        onValueChange={(next) => {
          edit.set(product, "status", next)
        }}
      >
        <SelectTrigger
          size="sm"
          className={cn("w-32", value !== product.status && "border-primary")}
          aria-label={t(`${Q}.statusOf`, { title: product.title })}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="published">{t("products.status.published")}</SelectItem>
          <SelectItem value="draft">{t("products.status.draft")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
