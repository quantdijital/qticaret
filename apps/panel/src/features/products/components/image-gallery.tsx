import { CircleCheck } from "lucide-react"
import { useState } from "react"
import type { DragEvent } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { MediaPicker } from "@/components/patterns/media-picker"
import { useRevealTarget } from "@qticaret/admin-ui/hooks/use-section-open"
import { handOnClips } from "@/features/media/video-intake"
import type { VideoIntake, YoutubeIntake } from "@/features/media/video-intake"
import { registerMedia } from "@/features/products/api/media"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { GalleryTile } from "./gallery-tile"
import type { GalleryImage } from "./gallery-tile"
import { GalleryZone } from "./gallery-zone"
import { PendingVideoTile, VideoTile } from "./video-tile"
import type { GalleryVideo } from "./video-tile"

export type { GalleryImage } from "./gallery-tile"
export type { GalleryVideo } from "./video-tile"

export const MAX_IMAGES = 20

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files")

/** The product's videos among its pictures (adr/0069 §10; the product page only). */
export interface GalleryVideos {
  items: GalleryVideo[]
  /** Clips going up now, each with the share sent. */
  pending: { key: string; name: string; progress: number | null }[]
  /** Where video files go; none: videos cannot be uploaded here (only pictures are taken). */
  intake?: VideoIntake | undefined
  /** Where a YouTube link typed into the dialog's address goes (slice 5). */
  youtube?: YoutubeIntake | undefined
  onOpen: (id: string) => void
}

interface ImageGalleryProps {
  images: GalleryImage[]
  onAdd: (stored: { id: string; url: string }[]) => void
  onRemove: (index: number) => void
  onMakeMain: (index: number) => void
  onMove: (from: number, to: number) => void
  /** Saves a picture's alt text (the product page); without it the tiles have none. */
  onAlt?: (index: number, alt: string) => void
  /** A save in flight elsewhere; the gallery waits for it. */
  disabled?: boolean
  /** The grid runs the page's width: more pictures to a row. */
  wide?: boolean
  /** The advisor's "alt text missing" lands here: the first picture without one opens. */
  altTarget?: string
  /** Videos with the pictures: their tiles after the first picture, video files taken too. */
  videos?: GalleryVideos | undefined
}

/**
 * A product's pictures (docs/18 §7, one way to add a picture): the drop
 * zone, or the last tile once there are pictures, opens the media
 * dialog on a click (library, upload, address); files dropped on it go
 * up at once. Tiles are dragged into order, the first is the main
 * picture; a click on one opens its alt text and its actions. With
 * `videos` (adr/0069 §10), the same zone and dialog take video files,
 * and the videos sit right after the first picture, never dragged.
 */
export function ImageGallery({
  images,
  onAdd,
  onRemove,
  onMakeMain,
  onMove,
  onAlt,
  disabled = false,
  wide = false,
  altTarget,
  videos,
}: ImageGalleryProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [over, setOver] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const [target, setTarget] = useState<number | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const room = MAX_IMAGES - images.length
  const intake = videos?.intake
  const takesVideo = Boolean(intake && !intake.refusal)
  // A YouTube link (slice 5) needs no upload on the server: room for a video is room for it
  const takesLink = Boolean(videos?.youtube && !videos.youtube.refusal)
  // Why no video is taken now (two already): said once, whichever way it would come
  const videoRefusal = intake?.refusal ?? videos?.youtube?.refusal ?? null
  const missing = onAlt ? images.filter((image) => image.alt && !image.alt.value.trim()) : []
  useRevealTarget(altTarget ?? "", () => {
    const first = missing.find((image) => !image.alt?.legacy)
    if (altTarget && first) {
      setOpenKey(first.key)
    }
  })

  const upload = async (dropped: File[]) => {
    const files = intake ? handOnClips(dropped, intake) : dropped
    if (files.length === 0 || room <= 0) {
      return
    }
    setBusy(true)
    try {
      const { files: stored } = await sdk.admin.upload.create({ files: files.slice(0, room) })
      let urls = stored.map((file) => file.url)
      try {
        // Product images get an alt text and versions (F3.3), under the address the
        // server keeps for them; the upload stands without them
        const { media } = await registerMedia(stored.map((file) => file.id))
        urls = media.map((each) => each.url)
      } catch (failure) {
        toast.warning(`${t("products.media.registerFailed")} ${errorText(t, failure)}`)
      }
      onAdd(stored.map((file, index) => ({ id: file.id, url: urls[index] ?? file.url })))
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setBusy(false)
    }
  }
  const working = busy || disabled
  // Files dragged in from the computer; a tile dragged within the grid is not one
  const fileDrop = {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (hasFiles(event)) {
        event.preventDefault()
        setOver(true)
      }
    },
    onDragLeave: () => {
      setOver(false)
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (hasFiles(event)) {
        event.preventDefault()
        setOver(false)
        void upload(Array.from(event.dataTransfer.files))
      }
    },
  }
  const zone = (compact: boolean) => (
    <GalleryZone
      compact={compact}
      busy={busy}
      over={over}
      disabled={working || (room <= 0 && !takesVideo && !takesLink)}
      label={
        takesVideo || takesLink
          ? t("products.media.addLabelVideo", { max: MAX_IMAGES })
          : t("products.media.addLabel", { max: MAX_IMAGES })
      }
      types={takesVideo ? t("products.media.typesVideo") : t("products.media.types")}
      onOpen={() => {
        setPicking(true)
      }}
    />
  )
  const imageTile = (image: GalleryImage, index: number) => (
    <GalleryTile
      key={image.key}
      image={image}
      index={index}
      count={images.length}
      disabled={working}
      withAlt={Boolean(onAlt)}
      open={openKey === image.key}
      onOpenChange={(open) => {
        setOpenKey(open ? image.key : null)
      }}
      dragging={dragging === index}
      target={target === index && dragging !== null && dragging !== index}
      drag={{
        start: () => {
          setDragging(index)
        },
        over: () => {
          setTarget(index)
        },
        end: () => {
          setDragging(null)
          setTarget(null)
        },
        drop: () => {
          if (dragging !== null && dragging !== index) {
            onMove(dragging, index)
          }
          setDragging(null)
          setTarget(null)
        },
      }}
      onMakeMain={() => {
        onMakeMain(index)
      }}
      onMove={(to) => {
        onMove(index, to)
      }}
      onRemove={() => {
        setOpenKey(null)
        onRemove(index)
      }}
      onAlt={(alt) => {
        onAlt?.(index, alt)
      }}
      // The AI background's result joins the others, the original stays (docs/22 PR 4-2)
      onAddImage={(stored) => {
        onAdd([stored])
      }}
      room={{ full: room <= 0, max: MAX_IMAGES }}
    />
  )
  const clips = videos?.items ?? []
  const sending = videos?.pending ?? []
  const filled = images.length + clips.length + sending.length > 0

  return (
    <div className="flex flex-col gap-3" {...fileDrop}>
      {!filled ? (
        zone(false)
      ) : (
        <ul
          id={altTarget}
          className={cn(
            "grid scroll-mt-28 grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6",
            // The page's width (a product's media card): more to a row, each a thumbnail's size
            wide && "md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9"
          )}
        >
          {images.slice(0, 1).map((image) => imageTile(image, 0))}
          {/* adr/0069 §2: the videos come right after the first picture */}
          {clips.map((video, at) => (
            <VideoTile
              key={video.id}
              video={video}
              number={at + 1}
              onOpen={() => {
                videos?.onOpen(video.id)
              }}
            />
          ))}
          {sending.map((item) => (
            <PendingVideoTile key={item.key} name={item.name} progress={item.progress} />
          ))}
          {images.slice(1).map((image, at) => imageTile(image, at + 1))}
          {room > 0 || takesVideo || takesLink ? <li>{zone(true)}</li> : null}
        </ul>
      )}
      {images.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            {t(onAlt ? "products.media.tilesHint" : "products.media.tilesHintNoAlt")}
          </span>
          {onAlt ? (
            missing.length > 0 ? (
              <span className="text-warning-text">
                {t("products.media.altMissing", { count: missing.length })}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-success-text">
                <CircleCheck className="size-3.5" aria-hidden="true" />
                {t("products.media.altComplete")}
              </span>
            )
          ) : null}
        </div>
      ) : null}
      {videoRefusal ? <p className="text-xs text-muted-foreground">{videoRefusal}</p> : null}
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        multiple
        max={Math.max(1, room)}
        title={t(
          takesVideo || takesLink ? "products.media.pickerTitleVideo" : "products.media.pickerTitle"
        )}
        video={intake}
        youtube={videos?.youtube}
        onSelect={(assets) => {
          // A picture the product has already is not added twice
          const shown = new Set(images.map((image) => image.url))
          const fresh = assets.filter((asset) => !shown.has(asset.url)).slice(0, room)
          if (fresh.length > 0) {
            onAdd(fresh.map((asset) => ({ id: asset.file_id ?? asset.id, url: asset.url })))
          }
        }}
      />
    </div>
  )
}
