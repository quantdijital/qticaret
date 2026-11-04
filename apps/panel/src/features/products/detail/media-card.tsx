import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { ImageUploader, MAX_IMAGES } from "@/features/products/components/image-uploader"
import { errorText } from "@/lib/errors"
import { AltTexts } from "./alt-texts"

interface Image {
  id?: string
  url: string
}

/**
 * The pictures, saved as they change; the first is the product's thumbnail.
 * Each gets its alt text below, and its versions are made on the server.
 */
export function MediaCard({ product, className }: { product: ProductDetail; className?: string }) {
  const { t } = useTranslation()
  const update = useUpdateProduct(product.id)
  const images: Image[] = [...(product.images ?? [])]
    .sort((a, b) => a.rank - b.rank)
    .map((image) => ({ id: image.id, url: image.url }))

  const save = (next: Image[]) => {
    update.mutate(
      { images: next, thumbnail: next[0]?.url ?? null },
      {
        onSuccess: () => toast.success(t("products.detail.mediaSaved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }

  return (
    <SectionCard
      title={t("products.media.card")}
      description={t("products.media.hint", { max: MAX_IMAGES })}
      {...(className ? { className } : {})}
    >
      <div className="flex flex-col gap-5">
        <ImageUploader
          images={images.map((image) => ({
            key: image.id ?? image.url,
            url: image.url,
          }))}
          disabled={update.isPending}
          wide
          onAdd={(stored) => {
            save([...images, ...stored.map(({ url }) => ({ url }))])
          }}
          onRemove={(index) => {
            save(images.filter((_, at) => at !== index))
          }}
          onMakeMain={(index) => {
            const chosen = images[index]
            if (chosen) {
              save([chosen, ...images.filter((_, at) => at !== index)])
            }
          }}
        />
        {images.length > 0 ? (
          <AltTexts
            productId={product.id}
            images={images.map((image) => ({ key: image.id ?? image.url, url: image.url }))}
            media={product.media_assets ?? []}
          />
        ) : null}
      </div>
    </SectionCard>
  )
}
