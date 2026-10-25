import { useNavigate } from "@tanstack/react-router"
import { EllipsisVertical, EyeOff, Loader2, Send, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDeleteProduct, useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"

/**
 * Publish or take back, the page's one main action; deleting sits in the
 * menu behind a question (docs/06 §6). The server holds the publish rules
 * (F3.1 measures), so a refusal comes back as its sentence.
 */
export function ProductActions({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const update = useUpdateProduct(product.id)
  const remove = useDeleteProduct()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const published = product.status === "published"

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
      onSuccess: () => {
        toast.success(t("products.detail.deleted"))
        void navigate({ to: "/products" })
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }

  return (
    <>
      <Button
        variant={published ? "outline" : "default"}
        disabled={update.isPending}
        onClick={toggle}
      >
        {update.isPending ? (
          <Loader2 className="animate-spin" />
        ) : published ? (
          <EyeOff />
        ) : (
          <Send />
        )}
        {t(published ? "products.detail.unpublish" : "products.detail.publish")}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t("products.detail.more")}>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
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
    </>
  )
}
