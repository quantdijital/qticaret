/**
 * The full image opening's video link: a YouTube or Vimeo video, only its
 * id taken (the storefront builds the player's address from the id
 * alone, never from the pasted link). The forms and hosts it takes:
 *
 * - `youtube.com/watch?v={id}`, `/shorts/{id}`, `/embed/{id}` (`www.`, `m.`, bare)
 * - `youtu.be/{id}`; `youtube-nocookie.com/embed/{id}` (`www.`, bare)
 * - `vimeo.com/{id}` (`www.`, bare); `player.vimeo.com/video/{id}`
 *
 * HTTPS or plain HTTP, a link without a scheme read as HTTPS; another
 * scheme, a name and password, a port or a look-alike host is refused.
 *
 * Mirrors `@qticaret/types`' `heroVideoOf` and `HERO_VIDEO_LIMITS` (the
 * backend reads no runtime value from that package); a unit test runs
 * both on the same links.
 */

export const HERO_VIDEO_LIMITS = {
  url: 2048,
  label: 40,
} as const

export type HeroVideoHost = "youtube" | "vimeo"

const IDS: Readonly<Record<HeroVideoHost, RegExp>> = {
  youtube: /^[A-Za-z0-9_-]{11}$/,
  vimeo: /^[0-9]{1,12}$/,
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"])
const NOCOOKIE_HOSTS = new Set(["youtube-nocookie.com", "www.youtube-nocookie.com"])
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com"])

// A scheme written out (`https:`, `javascript:`, `data:`): nothing is put before it
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/** One path segment after `prefix` (a trailing slash allowed), if it is the host's id. */
function segmentAfter(path: string, prefix: string, host: HeroVideoHost): string | null {
  if (!path.startsWith(prefix)) {
    return null
  }
  const rest = path.slice(prefix.length).replace(/\/$/, "")
  return !rest.includes("/") && IDS[host].test(rest) ? rest : null
}

function parse(input: string): URL | null {
  const text = input.trim()
  if (text === "" || text.length > HERO_VIDEO_LIMITS.url || text.startsWith("/")) {
    return null
  }
  try {
    const url = new URL(HAS_SCHEME.test(text) ? text : `https://${text}`)
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null
    }
    // WHATWG URL drops a port that is the scheme's default; any other is refused
    return url.username === "" && url.password === "" && url.port === "" ? url : null
  } catch {
    return null
  }
}

function youtubeId(url: URL): string | null {
  const { hostname: host, pathname: path } = url
  if (YOUTUBE_HOSTS.has(host)) {
    if (path === "/watch" || path === "/watch/") {
      // One `v` only: two would leave which video it is to whoever reads it
      const values = url.searchParams.getAll("v")
      const [only] = values
      return values.length === 1 && only !== undefined && IDS.youtube.test(only) ? only : null
    }
    return segmentAfter(path, "/shorts/", "youtube") ?? segmentAfter(path, "/embed/", "youtube")
  }
  if (host === "youtu.be") {
    return segmentAfter(path, "/", "youtube")
  }
  return NOCOOKIE_HOSTS.has(host) ? segmentAfter(path, "/embed/", "youtube") : null
}

function vimeoId(url: URL): string | null {
  if (VIMEO_HOSTS.has(url.hostname)) {
    return segmentAfter(url.pathname, "/", "vimeo")
  }
  return url.hostname === "player.vimeo.com" ? segmentAfter(url.pathname, "/video/", "vimeo") : null
}

/** The video a pasted link names, or null when it is not one of the forms above. */
export function heroVideoOf(input: unknown): { host: HeroVideoHost; id: string } | null {
  if (typeof input !== "string") {
    return null
  }
  const url = parse(input)
  if (!url) {
    return null
  }
  const youtube = youtubeId(url)
  if (youtube !== null) {
    return { host: "youtube", id: youtube }
  }
  const vimeo = vimeoId(url)
  return vimeo === null ? null : { host: "vimeo", id: vimeo }
}
