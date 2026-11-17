import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { useSaveAlt } from "@/features/products/api/media"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { productVideosQuery } from "@/features/products/api/videos"
import { ImageGallery, MAX_IMAGES } from "@/features/products/components/image-gallery"
import type { GalleryImage } from "@/features/products/components/image-gallery"
import { errorText } from "@/lib/errors"
import { MEDIA_ALT_TARGET } from "./sections"
import { useProductVideos } from "./use-product-videos"
import { VideoDialog } from "./video-dialog"

interface Image {
  id?: string
  url: string
}

/**
 * The pictures, saved as they change; the first is the product's thumbnail.
 * Each picture's alt text is a click away on its tile, and its versions
 * are made on the server. With product videos on (adr/0069 §10) it is
 * "Görseller ve videolar": the same zone and dialog take a clip, whose
 * tile follows the first picture and opens the "Video" dialog.
 */
export function MediaCard({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const update = useUpdateProduct(product.id)
  const saveAlt = useSaveAlt(product.id)
  const [openVideo, setOpenVideo] = useState<string | null>(null)
  const videos = useProductVideos(product.id, setOpenVideo)
  // The same list the gallery reads (one request): the open video as it is now
  const listed = useQuery(productVideosQuery(product.id, videos !== null))
  const shownVideo = listed.data?.videos.find((video) => video.id === openVideo) ?? null
  const images: Image[] = [...(product.images ?? [])]
    .sort((a, b) => a.rank - b.rank)
    .map((image) => ({ id: image.id, url: image.url }))
  const media = new Map((product.media_assets ?? []).map((each) => [each.url, each]))

  const save = (next: Image[]) => {
    update.mutate(
      { images: next, thumbnail: next[0]?.url ?? null },
      {
        onSuccess: () => toast.success(t("products.detail.mediaSaved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  const tiles: GalleryImage[] = images.map((image) => {
    const record = media.get(image.url)
    return {
      key: image.id ?? image.url,
      url: image.url,
      alt: {
        value: record?.alt ?? "",
        legacy: !record,
        versions: record?.file_id ? (record.derived_at ? "ready" : "pending") : null,
      },
    }
  })

  return (
    <SectionCard
      title={t(videos ? "products.media.cardVideo" : "products.media.card")}
      description={
        videos
          ? t("products.media.hintVideo", { max: MAX_IMAGES })
          : t("products.media.hint", { max: MAX_IMAGES })
      }
    >
      <ImageGallery
        images={tiles}
        disabled={update.isPending}
        wide
        altTarget={MEDIA_ALT_TARGET}
        videos={videos ?? undefined}
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
        onMove={(from, to) => {
          const next = [...images]
          const [moved] = next.splice(from, 1)
          if (moved && to >= 0 && to < images.length) {
            next.splice(to, 0, moved)
            save(next)
          }
        }}
        onAlt={(index, alt) => {
          const record = media.get(images[index]?.url ?? "")
          if (!record) {
            return
          }
          saveAlt.mutate(
            { id: record.id, alt },
            {
              onSuccess: () => toast.success(t("products.media.altSaved")),
              onError: (failure) => toast.error(errorText(t, failure)),
            }
          )
        }}
      />
      {videos ? (
        <VideoDialog
          productId={product.id}
          video={shownVideo}
          onClose={() => {
            setOpenVideo(null)
          }}
        />
      ) : null}
    </SectionCard>
  )
}
