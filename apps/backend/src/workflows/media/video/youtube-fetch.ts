import { z } from "@medusajs/framework/zod"
import { RetryableError, ValidationError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { youtubeOembedUrl, youtubePosterUrls } from "../../../lib/media/video/youtube"
import { isSafeFetchError, safeFetch } from "../../../lib/security/safe-fetch"
import { DEFAULT_UPLOAD_LIMITS } from "../../../lib/security/upload"

/**
 * What the server asks YouTube about a video (adr/0069 §8), only ever at
 * addresses built from its id (`lib/media/video/youtube.ts`), under the
 * SSRF rules of an address import (`import-fetch.ts`, docs/04): public
 * addresses only, bounded time and size. Nothing the shop typed is fetched.
 */

const OEMBED_TIMEOUT_MS = 8_000
// oEmbed's JSON is a few hundred bytes; a page this size is not an answer
const OEMBED_MAX_BYTES = 64 * 1024
const POSTER_TIMEOUT_MS = 15_000

/** A cover picture is at most an upload's size (10 MB); `maxresdefault` is ~100 KB. */
export const POSTER_MAX_BYTES = DEFAULT_UPLOAD_LIMITS.maxBytes

/**
 * oEmbed refuses a video that cannot be embedded here: 401 (embedding
 * off, a private video), 403, 404 (removed) and, as seen on 2026-11-17 for
 * an id no video has, 400. Each reads as "not embeddable or not public".
 */
const REFUSED_STATUSES = new Set([400, 401, 403, 404])

const oembedSchema = z.object({ title: z.string().optional() })

export interface OembedAnswer {
  status: number
  body: Buffer
}

/** A cover picture: its bytes, or null when YouTube has none at that size (or it failed). */
export type PosterAnswer = Buffer | null

async function getOembed(id: string): Promise<OembedAnswer> {
  const answer = await safeFetch(youtubeOembedUrl(id), {
    timeoutMs: OEMBED_TIMEOUT_MS,
    maxResponseBytes: OEMBED_MAX_BYTES,
    redirect: "error",
    headers: { accept: "application/json" },
  })
  return { status: answer.status, body: answer.body }
}

async function getPoster(address: string): Promise<PosterAnswer> {
  const answer = await safeFetch(address, {
    timeoutMs: POSTER_TIMEOUT_MS,
    maxResponseBytes: POSTER_MAX_BYTES,
    maxRedirects: 3,
    redirect: "follow",
  })
  return answer.status === 200 ? answer.body : null
}

/**
 * The calls themselves. Tests put a fake YouTube's answers in their place:
 * the real ones refuse a local server, which is the point.
 */
export const youtubeFetch = { oembed: getOembed, poster: getPoster }

/**
 * Whether the video may be embedded, and its title on YouTube (null when
 * it has none). Refused by YouTube: `video.youtube_unavailable`; YouTube
 * out of reach or answering oddly: `video.youtube_unreachable`, to try
 * again (nothing was kept).
 */
export async function checkYoutubeVideo(id: string): Promise<{ title: string | null }> {
  let answer: OembedAnswer
  try {
    answer = await youtubeFetch.oembed(id)
  } catch (error) {
    logger.warn({
      event: "media.youtube_unreachable",
      reason: isSafeFetchError(error) ? error.reason : errorSummary(error),
    })
    throw new RetryableError("video.youtube_unreachable")
  }
  if (REFUSED_STATUSES.has(answer.status)) {
    throw new ValidationError("video.youtube_unavailable", { field: "url" })
  }
  if (answer.status !== 200) {
    logger.warn({ event: "media.youtube_unreachable", status: answer.status })
    throw new RetryableError("video.youtube_unreachable")
  }
  let parsed: z.infer<typeof oembedSchema>
  try {
    parsed = oembedSchema.parse(JSON.parse(answer.body.toString("utf8")))
  } catch {
    logger.warn({ event: "media.youtube_unreadable" })
    throw new RetryableError("video.youtube_unreachable")
  }
  const title = parsed.title?.trim() ?? ""
  return { title: title === "" ? null : title }
}

/**
 * The video's largest cover picture YouTube has (`maxresdefault`, else
 * `hqdefault`), or null: a missing one is no refusal, the storefront then
 * shows the product's first picture (adr/0069 §8).
 */
export async function fetchYoutubePoster(id: string): Promise<Buffer | null> {
  for (const address of youtubePosterUrls(id)) {
    try {
      const bytes = await youtubeFetch.poster(address)
      if (bytes && bytes.length > 0) {
        return bytes
      }
    } catch (error) {
      logger.warn({
        event: "media.youtube_poster_unreachable",
        reason: isSafeFetchError(error) ? error.reason : errorSummary(error),
      })
    }
  }
  return null
}
