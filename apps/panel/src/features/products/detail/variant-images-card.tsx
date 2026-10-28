import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { ProductDetail } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"
import { cn } from "@/lib/utils"

function useToggleImageVariant(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ imageId, variantId, on }: { imageId: string; variantId: string; on: boolean }) =>
      sdk.admin.product.batchImageVariants(
        productId,
        imageId,
        on ? { add: [variantId] } : { remove: [variantId] }
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["products", "detail", productId] })
    },
  })
}

/**
 * Which variants each picture shows (Medusa's variant images): a picture
 * tied to no variant shows with all of them; tied to some, only with those.
 * A storefront brings a variant's pictures forward when it is chosen.
 */
export function VariantImagesCard({
  product,
  className,
}: {
  product: ProductDetail
  className?: string
}) {
  const { t } = useTranslation()
  const toggle = useToggleImageVariant(product.id)
  const images = [...(product.images ?? [])].sort((a, b) => a.rank - b.rank)
  const variants = product.variants ?? []
  return (
    <SectionCard
      title={t("products.variantImages.title")}
      description={t("products.variantImages.hint")}
      {...(className ? { className } : {})}
    >
      <ul className="flex flex-col divide-y">
        {images.map((image, index) => {
          const tied = new Set(
            ((image as { variants?: { id: string }[] | null }).variants ?? []).map(
              (variant) => variant.id
            )
          )
          return (
            <li key={image.id} className="flex items-center gap-3 py-3">
              <img
                src={image.url}
                alt=""
                className="size-12 shrink-0 rounded-md border object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {variants.map((variant) => {
                  const on = tied.has(variant.id)
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      aria-pressed={on}
                      aria-label={t("products.variantImages.toggle", {
                        variant: variant.title,
                        position: index + 1,
                      })}
                      disabled={toggle.isPending}
                      onClick={() => {
                        toggle.mutate(
                          { imageId: image.id, variantId: variant.id, on: !on },
                          { onError: (failure) => toast.error(errorText(t, failure)) }
                        )
                      }}
                      className={cn(
                        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {on ? <Check className="size-3" aria-hidden="true" /> : null}
                      {variant.title}
                    </button>
                  )
                })}
              </div>
              {tied.size === 0 ? (
                <StatusBadge tone="neutral">{t("products.variantImages.all")}</StatusBadge>
              ) : null}
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}
