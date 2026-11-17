import { Film, Play } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { VideoStatus } from "@/features/products/api/videos"
import { videoTileLabel } from "@/features/products/video-facts"

/** A video as the gallery shows it: its poster, its state, its name. */
export interface GalleryVideo {
  id: string
  status: VideoStatus
  title: string | null
  posterUrl: string | null
}

const TILE =
  "relative block aspect-square w-full overflow-hidden rounded-lg border bg-muted outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"

/**
 * A video among the pictures (adr/0069 §10): the poster (or a film mark
 * while there is none), a play mark in the corner, "İşleniyor" or
 * "İşlenemedi" on it. The size of a picture's tile; never dragged (a
 * video is never the first). A click opens the "Video" dialog.
 */
export function VideoTile({
  video,
  number,
  onOpen,
}: {
  video: GalleryVideo
  /** Its place among the product's videos (1, 2): its name while it has no title. */
  number: number
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const label = videoTileLabel(video.status)
  const title = video.title?.trim() ?? ""
  const name = title === "" ? t("products.videos.numbered", { number }) : title
  return (
    <li className="relative min-w-0 rounded-lg">
      <button
        type="button"
        aria-label={[name, label ? t(`products.videos.status.${label}`) : ""]
          .filter(Boolean)
          .join(", ")}
        className={cn(TILE, "group cursor-pointer")}
        onClick={onOpen}
      >
        {video.posterUrl ? (
          <img
            src={video.posterUrl}
            alt=""
            draggable={false}
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <Film className="size-6" aria-hidden="true" />
          </span>
        )}
        <span className="absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full bg-foreground/70 text-background">
          <Play className="size-3 fill-current" aria-hidden="true" />
        </span>
        {label ? (
          <span
            className={cn(
              "absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
              label === "failed"
                ? "bg-destructive-soft text-destructive-text"
                : "bg-background/90 text-foreground"
            )}
          >
            {t(`products.videos.status.${label}`)}
          </span>
        ) : null}
      </button>
    </li>
  )
}

/** A clip going up: its name and the share sent, in a tile the size of the others. */
export function PendingVideoTile({ name, progress }: { name: string; progress: number | null }) {
  const { t } = useTranslation()
  const percent = progress === null ? null : Math.round(progress * 100)
  return (
    <li className="min-w-0">
      <div
        className="flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border bg-muted px-3 text-center"
        aria-live="polite"
      >
        <Film className="size-5 text-muted-foreground" aria-hidden="true" />
        <span className="w-full truncate text-xs font-medium">{name}</span>
        {/* Without a size yet the bar only pulses: under way, not how far */}
        <Progress
          aria-label={t("products.videos.uploading")}
          className={cn("h-1.5", percent === null && "animate-pulse")}
          value={percent}
        />
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {percent === null
            ? t("products.videos.uploading")
            : t("products.videos.uploadingPercent", { percent })}
        </span>
      </div>
    </li>
  )
}
