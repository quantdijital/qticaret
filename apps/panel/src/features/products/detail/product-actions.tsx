import { useNavigate } from "@tanstack/react-router"
import {
  Copy,
  EllipsisVertical,
  EyeOff,
  LayoutPanelLeft,
  Loader2,
  Send,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
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
import type { ProductDetail } from "@/features/products/api/products"
import { StorefrontButton } from "@/features/products/detail/storefront-button"
import { useDuplicateAndOpen } from "@/features/products/use-duplicate"
import { errorText } from "@/lib/errors"

/**
 * The product page's header actions (docs/06 "Ürün sayfası"; the owner
 * 2026-11-26: everything side by side was cramped): its page on the
 * storefront as one icon (live, or a draft's preview; named on hover),
 * the page's save (`save`: "Vazgeç" while something changed, "Kaydet")
 * and one "…" menu holding the rest: publish or take back, "Sayfayı
 * düzenle", copy and delete, deleting behind a question (docs/06 §6). The
 * status stays beside the title. The server holds the publish rules (the
 * SEO gate; measures are optional, adr/0054), so a refusal comes back as
 * its sentence. "Sayfayı düzenle" (`onCustomize`, for a role that may
 * change the shop's settings) lays the page out for the whole team.
 */
export function ProductActions({
  product,
  onCustomize,
  save,
  view,
}: {
  product: ProductDetail
  onCustomize?: (() => void) | undefined
  /** The page's save (`HeaderSaveActions`), before the menu. */
  save?: ReactNode
  /** The person's own view of the page ("Görünüm"), before the save. */
  view?: ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const update = useUpdateProduct(product.id)
  const remove = useDeleteProduct()
  const duplicate = useDuplicateAndOpen()
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
      <StorefrontButton product={product} />
      {view}
      {save}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t("products.detail.more")}>
            {/* Publishing from the menu: its wait shows on the button that opened it */}
            {update.isPending ? <Loader2 className="animate-spin" /> : <EllipsisVertical />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem disabled={update.isPending} onSelect={toggle}>
            {published ? <EyeOff /> : <Send />}
            {t(published ? "products.detail.unpublish" : "products.detail.publish")}
          </DropdownMenuItem>
          {onCustomize ? (
            <DropdownMenuItem onSelect={onCustomize}>
              <LayoutPanelLeft />
              {t("products.layout.customize")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            disabled={duplicate.pending}
            onSelect={() => {
              duplicate.run(product.id)
            }}
          >
            <Copy />
            {t("products.duplicate.action")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
