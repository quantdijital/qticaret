import { Film } from "lucide-react"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useVideoTitle } from "@/features/products/api/videos"
import type { ProductVideo } from "@/features/products/api/videos"
import { VIDEO_TITLE_MAX } from "@/features/products/video-facts"
import { errorText } from "@/lib/errors"

const V = "products.videos"

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-3 py-2 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 break-words tabular-nums">{children}</dd>
    </div>
  )
}

/**
 * The clip itself: played once it is ready (muted, with the browser's
 * controls), its poster or a film mark before that. The box is the
 * image dialog's square.
 */
export function VideoPreview({ video }: { video: ProductVideo }) {
  const { t } = useTranslation()
  const { mp4, webm } = video.outputs ?? {}
  return (
    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted">
      {video.status === "ready" && (mp4 ?? webm) ? (
        <video
          controls
          muted
          playsInline
          preload="metadata"
          poster={video.poster?.url}
          aria-label={video.title ?? t(`${V}.dialogTitle`)}
          className="max-h-full max-w-full"
        >
          {webm ? <source src={webm.url} type="video/webm" /> : null}
          {mp4 ? <source src={mp4.url} type="video/mp4" /> : null}
        </video>
      ) : video.poster ? (
        <img src={video.poster.url} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <Film className="size-8 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  )
}

/** The title (the player's name on the storefront; empty: the product's), saved while changed. */
export function TitleForm({
  productId,
  video,
  onDirtyChange,
}: {
  productId: string
  video: ProductVideo
  onDirtyChange: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const save = useVideoTitle(productId)
  const [title, setTitle] = useState(video.title ?? "")
  const dirty = title.trim() !== (video.title ?? "")
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate(
          { id: video.id, title: title.trim() || null },
          {
            onSuccess: () => toast.success(t(`${V}.titleSaved`)),
            onError: (failure) => toast.error(errorText(t, failure)),
          }
        )
      }}
    >
      <Field label={t(`${V}.title`)} htmlFor="video-title" hint={t(`${V}.titleHint`)}>
        <Input
          id="video-title"
          value={title}
          maxLength={VIDEO_TITLE_MAX}
          placeholder={t(`${V}.titlePlaceholder`)}
          onChange={(event) => {
            setTitle(event.target.value)
          }}
        />
      </Field>
      {dirty ? (
        <Button type="submit" size="sm" className="self-end" disabled={save.isPending}>
          {t(`${V}.saveTitle`)}
        </Button>
      ) : null}
    </form>
  )
}
