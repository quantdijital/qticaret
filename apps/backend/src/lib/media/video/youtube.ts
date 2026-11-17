/**
 * A YouTube link (adr/0069 §8): only the video's 11-character id is taken
 * from what the shop pasted, and only from these forms on these hosts:
 *
 * - `youtube.com/watch?v={id}` (`www.`, `m.`, bare)
 * - `youtube.com/shorts/{id}`, `youtube.com/embed/{id}` (same hosts)
 * - `youtu.be/{id}`
 * - `youtube-nocookie.com/embed/{id}` (`www.`, bare)
 *
 * HTTPS, or plain HTTP (the id is all that is kept, so the scheme changes
 * nothing; a link copied from an old page still works). A link without a
 * scheme (`youtu.be/…`) is read as HTTPS. Anything else is refused: another
 * scheme, a name and password, a port, a host that only looks like
 * YouTube's. The pasted address is never stored or used again; every
 * address to YouTube is built here from the id.
 */

import { VIDEO_TITLE_MAX } from "./limits"
import { cleanVideoTitle } from "./receive"

/** A YouTube video's id: 11 characters of the URL-safe base64 alphabet. */
export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/** Longer than any real link to a video: refused before it is parsed. */
export const YOUTUBE_URL_MAX = 2048

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"])
const SHORT_HOSTS = new Set(["youtu.be"])
const NOCOOKIE_HOSTS = new Set(["youtube-nocookie.com", "www.youtube-nocookie.com"])

// A scheme written out (`https:`, `javascript:`, `data:`): nothing is put before it
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

const idOrNull = (value: string | null | undefined): string | null =>
  typeof value === "string" && YOUTUBE_ID.test(value) ? value : null

/** One path segment after `prefix` (`/shorts/{id}`, a trailing slash allowed), or null. */
function segmentAfter(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) {
    return null
  }
  const rest = pathname.slice(prefix.length).replace(/\/$/, "")
  return rest.includes("/") ? null : idOrNull(rest)
}

function parse(input: string): URL | null {
  const text = input.trim()
  if (text === "" || text.length > YOUTUBE_URL_MAX || text.startsWith("/")) {
    return null
  }
  try {
    return new URL(HAS_SCHEME.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
}

/** The video's id in a YouTube link, or null when the link is not one of the forms above. */
export function youtubeIdOf(input: string): string | null {
  const url = parse(input)
  if (!url) {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null
  }
  // WHATWG URL drops a port that is the scheme's default; any other is refused
  if (url.username !== "" || url.password !== "" || url.port !== "") {
    return null
  }
  const host = url.hostname
  const path = url.pathname
  if (YOUTUBE_HOSTS.has(host)) {
    if (path === "/watch" || path === "/watch/") {
      // One `v` only: two would leave which video it is to whoever reads it
      const values = url.searchParams.getAll("v")
      return values.length === 1 ? idOrNull(values[0]) : null
    }
    return segmentAfter(path, "/shorts/") ?? segmentAfter(path, "/embed/")
  }
  if (SHORT_HOSTS.has(host)) {
    return segmentAfter(path, "/")
  }
  if (NOCOOKIE_HOSTS.has(host)) {
    return segmentAfter(path, "/embed/")
  }
  return null
}

const checked = (id: string): string => {
  if (!YOUTUBE_ID.test(id)) {
    throw new Error("youtube: not a video id")
  }
  return id
}

/** Where the storefront plays it once pressed: the privacy-enhanced player (adr/0069 §7). */
export const youtubeEmbedUrl = (id: string): string =>
  `https://www.youtube-nocookie.com/embed/${checked(id)}`

/** The video's own page: the panel's "YouTube'da aç", and what oEmbed is asked about. */
export const youtubeWatchUrl = (id: string): string =>
  `https://www.youtube.com/watch?v=${checked(id)}`

/** YouTube's oEmbed answer for the video: whether it may be embedded, and its title. */
export const youtubeOembedUrl = (id: string): string =>
  `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeWatchUrl(id))}&format=json`

/**
 * YouTube's title (oEmbed) as a title of ours: format and control
 * characters dropped, one line, at most 200 characters; null when nothing
 * is left. It only ever fills a title the shop left empty.
 */
export function titleFromYoutube(title: string | null): string | null {
  if (title === null) {
    return null
  }
  const line = title
    .replace(/[\p{Cf}\p{Cc}\p{Zl}\p{Zp}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  try {
    return cleanVideoTitle(cutTo(line, VIDEO_TITLE_MAX).trim())
  } catch {
    return null
  }
}

/**
 * At most `max` UTF-16 units, as `cleanVideoTitle` counts (security review
 * S2), never ending on half a surrogate pair: an emoji is kept whole or
 * left out.
 */
function cutTo(text: string, max: number): string {
  let cut = ""
  for (const char of text) {
    if (cut.length + char.length > max) {
      break
    }
    cut += char
  }
  return cut
}

/** The video's cover pictures, the largest first (`maxresdefault` is missing on some). */
export const youtubePosterUrls = (id: string): string[] =>
  ["maxresdefault", "hqdefault"].map((name) => `https://i.ytimg.com/vi/${checked(id)}/${name}.jpg`)
