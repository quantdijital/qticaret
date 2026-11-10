import { CircleAlert, CircleCheck, ImagePlus } from "lucide-react"
import { useImperativeHandle, useState } from "react"
import type { DragEvent, Ref } from "react"
import { useTranslation } from "react-i18next"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import {
  IMAGE_ACCEPT,
  fileProblem,
  uploadToLibrary,
  useMediaChanged,
} from "@/features/media/api/media"
import type { MediaAsset } from "@/features/media/api/media"
import { errorText } from "@/lib/errors"
import { cn } from "@qticaret/admin-ui/lib/utils"

// One drop at a time: what a person sorts through at once
export const MAX_FILES_PER_DROP = 20

type Status = "waiting" | "uploading" | "done" | "failed"

interface Queued {
  key: string
  name: string
  status: Status
  error?: string
}

/** What a dialog around the zone calls for files dropped anywhere on it. */
export interface UploadZoneHandle {
  upload: (files: File[]) => void
}

interface UploadZoneProps {
  /** A picker for one image takes one file. */
  multiple?: boolean
  /** The zone fills the room it is given (a dialog's tab). */
  fill?: boolean
  ref?: Ref<UploadZoneHandle> | undefined
  /**
   * The files that made it into the library, once the drop is through, and
   * how many did not (their reasons stay listed here).
   */
  onUploaded: (assets: MediaAsset[], failed: number) => void
}

/**
 * Files from this computer into the library: dropped or chosen, several at
 * once, each sent in turn with its own state, a bar for the whole drop.
 * A file of the wrong type or past 10 MB is named and skipped.
 */
export function UploadZone({ multiple = true, fill = false, ref, onUploaded }: UploadZoneProps) {
  const { t } = useTranslation()
  const changed = useMediaChanged()
  const [over, setOver] = useState(false)
  const [queue, setQueue] = useState<Queued[]>([])
  const busy = queue.some((item) => item.status === "waiting" || item.status === "uploading")
  const finished = queue.filter((item) => item.status === "done" || item.status === "failed")

  const mark = (key: string, status: Status, error?: string) => {
    setQueue((items) =>
      items.map((item) =>
        item.key === key ? { ...item, status, ...(error ? { error } : {}) } : item
      )
    )
  }

  const upload = async (files: File[]) => {
    const chosen = files.slice(0, multiple ? MAX_FILES_PER_DROP : 1)
    if (chosen.length === 0 || busy) {
      return
    }
    const stamp = Date.now()
    const items = chosen.map((file, index) => ({
      key: `${String(stamp)}-${String(index)}`,
      name: file.name,
      status: "waiting" as const,
    }))
    setQueue(items)
    const stored: MediaAsset[] = []
    for (const [index, file] of chosen.entries()) {
      const key = items[index]?.key ?? ""
      const problem = fileProblem(file)
      if (problem) {
        mark(key, "failed", t(`media.upload.problem.${problem}`))
        continue
      }
      mark(key, "uploading")
      try {
        stored.push(await uploadToLibrary(file))
        mark(key, "done")
      } catch (failure) {
        mark(key, "failed", errorText(t, failure))
      }
    }
    await changed()
    if (stored.length > 0) {
      onUploaded(stored, chosen.length - stored.length)
    }
  }

  useImperativeHandle(ref, () => ({
    upload: (files) => {
      void upload(files)
    },
  }))

  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setOver(false)
    void upload(Array.from(event.dataTransfer.files))
  }

  return (
    <div className={cn("flex flex-col gap-4", fill && "min-h-0 flex-1")}>
      <label
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => {
          setOver(false)
        }}
        onDrop={drop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
          over ? "border-primary bg-accent" : "border-border hover:border-input hover:bg-muted/50",
          busy && "pointer-events-none opacity-60",
          fill && "min-h-48 flex-1"
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <ImagePlus className="size-5" aria-hidden="true" />
        </span>
        <span className="text-sm font-medium">
          {t(multiple ? "media.upload.drop" : "media.upload.dropOne")}
        </span>
        <span className="text-xs text-muted-foreground">{t("media.upload.types")}</span>
        <input
          type="file"
          accept={IMAGE_ACCEPT}
          multiple={multiple}
          className="sr-only"
          disabled={busy}
          aria-label={t("media.upload.choose")}
          onChange={(event) => {
            void upload(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
        />
      </label>
      {queue.length > 0 ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <div className="flex items-center gap-3">
            <Progress
              value={(finished.length / queue.length) * 100}
              aria-label={t("media.upload.progress")}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("media.upload.count", { done: finished.length, total: queue.length })}
            </span>
          </div>
          <ul className="flex flex-col divide-y rounded-md border">
            {queue.map((item) => (
              <li key={item.key} className="flex min-h-10 items-center gap-3 px-3 py-2 text-[13px]">
                {item.status === "done" ? (
                  <CircleCheck className="size-4 shrink-0 text-success-text" aria-hidden="true" />
                ) : item.status === "failed" ? (
                  <CircleAlert
                    className="size-4 shrink-0 text-destructive-text"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="size-4 shrink-0 rounded-full border-2 border-muted-foreground/40" />
                )}
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs",
                    item.status === "failed" ? "text-destructive-text" : "text-muted-foreground"
                  )}
                >
                  {item.error ?? t(`media.upload.status.${item.status}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
