import { Copy, EllipsisVertical, ExternalLink, Eye, EyeOff, Send, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { useDeleteProduct, useUpdateProduct } from "@/features/products/api/products"
import type { ProductListItem } from "@/features/products/api/products"
import { useOpenStorefront } from "@/features/products/use-open-storefront"
import { errorText } from "@/lib/errors"

/**
 * A row's ⋯ menu, WooCommerce's row actions: see it on the storefront
 * (a draft's preview), publish or take back, copy (owner 2026-11-06) and
 * delete behind the same question the product page asks. Clicks here
 * stay here: the row itself opens the product.
 */
export function ProductRowMenu({
  product,
  onDuplicate,
}: {
  product: ProductListItem
  onDuplicate: (product: ProductListItem) => void
}) {
  const { t } = useTranslation()
  const storefront = useOpenStorefront(product.id)
  const update = useUpdateProduct(product.id)
  const remove = useDeleteProduct()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const published = product.status === "published"
  // The server holds the publish rules (the SEO gate): a refusal comes back as its sentence
  const toggle = () => {
    update.mutate(
      { status: published ? "draft" : "published" },
      {
        onSuccess: () =>
          toast.success(t(published ? "products.detail.unpublished" : "products.detail.published")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  const destroy = () => {
    remove.mutate(product.id, {
      onSuccess: () => toast.success(t("products.detail.deleted")),
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  return (
    <div
      onClick={(event) => {
        event.stopPropagation()
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("products.rowActions", { title: product.title })}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={storefront.isPending} onSelect={storefront.open}>
            {published ? <ExternalLink /> : <Eye />}
            {t(published ? "products.detail.viewOnStore" : "products.detail.preview")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={update.isPending} onSelect={toggle}>
            {published ? <EyeOff /> : <Send />}
            {t(published ? "products.detail.unpublish" : "products.detail.publish")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              onDuplicate(product)
            }}
          >
            <Copy />
            {t("products.duplicate.action")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={remove.isPending}
            onSelect={() => {
              setConfirmDelete(true)
            }}
          >
            <Trash2 />
            {t("products.detail.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("products.detail.deleteTitle", { title: product.title })}
        description={t("products.detail.deleteDescription")}
        confirmLabel={t("products.detail.delete")}
        destructive
        onConfirm={destroy}
      />
    </div>
  )
}
