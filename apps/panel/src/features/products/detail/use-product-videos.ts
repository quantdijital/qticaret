import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import type { VideoIntake } from "@/features/media/video-intake"
import { useFeatureState } from "@/features/settings/api/features"
import {
  PRODUCT_VIDEOS_FLAG,
  VIDEO_ACCEPT,
  isVideoFile,
  productVideosQuery,
} from "@/features/products/api/videos"
import type { GalleryVideos } from "@/features/products/components/image-gallery"
import { useVideoUploads } from "./use-video-uploads"

/**
 * A product's videos as its media card shows them (adr/0069 §10), or null
 * while the flag is off (or not known yet): the card is then the pictures'
 * alone, as before. Uploads are offered only where the server can take a
 * clip (`upload`) and while the product has room (two at most; when full,
 * why not is said and video files are refused).
 */
export function useProductVideos(
  productId: string,
  onOpen: (id: string) => void
): GalleryVideos | null {
  const { t } = useTranslation()
  const on = useFeatureState(PRODUCT_VIDEOS_FLAG) === true
  const list = useQuery(productVideosQuery(productId, on))
  const data = list.data
  const room = data ? Math.max(0, data.limit - data.videos.length) : 0
  const uploads = useVideoUploads(productId, room)
  if (!on || !data) {
    return null
  }
  const full = room - uploads.pending.length <= 0
  const intake: VideoIntake | undefined = data.upload
    ? {
        isVideo: isVideoFile,
        take: uploads.take,
        accept: VIDEO_ACCEPT,
        types: t("products.videos.types"),
        refusal: full ? t("products.videos.errors.limit_per_product") : null,
      }
    : undefined
  return {
    items: data.videos.map((video) => ({
      id: video.id,
      status: video.status,
      title: video.title,
      posterUrl: video.poster?.url ?? null,
    })),
    pending: uploads.pending,
    intake,
    onOpen,
  }
}
