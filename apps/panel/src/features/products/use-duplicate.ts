import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useDuplicateProduct } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"

/**
 * "Kopyala" (owner 2026-11-06), from the list's row menu or the product's
 * own: the copy is made as a draft and opened, the toast says so.
 */
export function useDuplicateAndOpen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const duplicate = useDuplicateProduct()
  return {
    pending: duplicate.isPending,
    run: (productId: string) => {
      duplicate.mutate(productId, {
        onSuccess: (copy) => {
          toast.success(t("products.duplicate.done", { title: copy.title }))
          void navigate({ to: "/products/$id", params: { id: copy.id } })
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      })
    },
  }
}
