import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import type { ReviewPhoto } from "@/features/reviews/api/reviews"

const R = "reviews.photos"

/**
 * A review's photos as small thumbnails: staff approve or reject them with
 * the review. One opens larger in a dialog.
 */
export function ReviewPhotos({ photos, author }: { photos: ReviewPhoto[]; author: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<number | null>(null)
  const shown = open === null ? null : (photos[open] ?? null)
  if (photos.length === 0) {
    return null
  }
  return (
    <>
      <ul className="flex flex-wrap gap-2" aria-label={t(`${R}.list`, { author })}>
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              className="block size-16 overflow-hidden rounded-md border bg-muted"
              onClick={() => {
                setOpen(index)
              }}
            >
              <img
                src={photo.url}
                alt={t(`${R}.alt`, { author, number: index + 1 })}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                className="size-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      <Dialog
        open={shown !== null}
        onOpenChange={(next) => {
          if (!next) {
            setOpen(null)
          }
        }}
      >
        <DialogContent size="lg" pane="fixed">
          <DialogHeader>
            <DialogTitle>{t(`${R}.title`, { author })}</DialogTitle>
            <DialogDescription>
              {t(`${R}.position`, { number: (open ?? 0) + 1, count: photos.length })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="items-center justify-center">
            {shown ? (
              <img
                src={shown.url}
                alt={t(`${R}.alt`, { author, number: (open ?? 0) + 1 })}
                width={shown.width}
                height={shown.height}
                className="max-h-full w-auto max-w-full min-h-0 rounded-md object-contain"
              />
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
