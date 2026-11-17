import { z } from "@medusajs/framework/zod"
import { VIDEO_TITLE_MAX } from "../../../../../lib/media/video/limits"
import { cleanVideoTitle } from "../../../../../lib/media/video/receive"
import { YOUTUBE_URL_MAX } from "../../../../../lib/media/video/youtube"

/**
 * A video's title (adr/0069 §1): trimmed, empty or null clears it (the
 * product's name stands in), at most 200 characters on one line, as the
 * upload takes it.
 */
export const AdminUpdateProductVideo = z
  .object({
    title: z
      .string()
      .max(VIDEO_TITLE_MAX * 4, "video.title_invalid")
      .nullable()
      .transform((value, ctx) => {
        if (value === null) {
          return null
        }
        try {
          return cleanVideoTitle(value)
        } catch {
          ctx.addIssue({ code: "custom", message: "video.title_invalid" })
          return z.NEVER
        }
      }),
  })
  .strict()
export type AdminUpdateProductVideoType = z.infer<typeof AdminUpdateProductVideo>

/** "Yeniden dene" takes no body but an empty JSON object (the admin's CSRF rule). */
export const AdminRetryProductVideo = z.object({}).strict()

/**
 * A YouTube link (adr/0069 §8): the address as pasted (the route takes
 * its video id only; `video.youtube_invalid` otherwise) and an optional
 * title under the same rule as an upload's.
 */
export const AdminAddYoutubeVideo = z
  .object({
    url: z.string().max(YOUTUBE_URL_MAX, "video.youtube_invalid"),
    title: z
      .string()
      .max(VIDEO_TITLE_MAX * 4, "video.title_invalid")
      .nullish()
      .transform((value, ctx) => {
        if (value === null || value === undefined) {
          return null
        }
        try {
          return cleanVideoTitle(value)
        } catch {
          ctx.addIssue({ code: "custom", message: "video.title_invalid" })
          return z.NEVER
        }
      }),
  })
  .strict()
export type AdminAddYoutubeVideoType = z.infer<typeof AdminAddYoutubeVideo>
