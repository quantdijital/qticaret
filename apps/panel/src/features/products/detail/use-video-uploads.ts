import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { uploadProductVideo } from "@/features/products/api/video-upload"
import { VIDEO_MAX_BYTES, useVideosChanged } from "@/features/products/api/videos"
import { errorText } from "@/lib/errors"

/** A clip on its way up: its name and the share sent (null: not known yet). */
export interface PendingVideo {
  key: string
  name: string
  progress: number | null
}

/**
 * The product's clips going up, one after another (each up to 50 MB): a
 * tile each with its progress until the server has it, then the list is
 * read again (and polled while the job works). `room` is how many more
 * the product takes; past it, and past 50 MB, a file is refused here with
 * the server's own reason.
 */
export function useVideoUploads(productId: string, room: number) {
  const { t } = useTranslation()
  const changed = useVideosChanged(productId)
  const [pending, setPending] = useState<PendingVideo[]>([])
  const queue = useRef(Promise.resolve())
  const counter = useRef(0)

  const set = (key: string, progress: number | null) => {
    setPending((items) => items.map((item) => (item.key === key ? { ...item, progress } : item)))
  }

  const send = async (key: string, file: File) => {
    try {
      await uploadProductVideo(productId, file, (share) => {
        set(key, share)
      })
      toast.success(t("products.videos.uploaded"))
    } catch (failure) {
      toast.error(`${file.name}: ${errorText(t, failure)}`)
    } finally {
      await changed()
      setPending((items) => items.filter((item) => item.key !== key))
    }
  }

  const take = (files: File[]) => {
    const free = Math.max(0, room - pending.length)
    const fitting = files.filter((file) => {
      if (file.size > VIDEO_MAX_BYTES) {
        toast.error(`${file.name}: ${t("products.videos.errors.too_large")}`)
        return false
      }
      return true
    })
    if (fitting.length > free) {
      toast.error(t("products.videos.errors.limit_per_product"))
    }
    for (const file of fitting.slice(0, free)) {
      counter.current += 1
      const key = `video-${String(counter.current)}`
      setPending((items) => [...items, { key, name: file.name, progress: null }])
      // One at a time: each is up to 50 MB and an ffprobe run on the server
      queue.current = queue.current.then(() => send(key, file))
    }
  }

  return { pending, take }
}
