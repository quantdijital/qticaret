/**
 * The full image opening's video button (`hero` `full_image`): the shop
 * pastes a YouTube or Vimeo link, only the video's id is taken from it,
 * and the player's address is built here from that id alone. The pasted
 * address is never framed: a link that is not one of these forms on these
 * hosts is refused, as is another scheme, a name and password, a port or a
 * host that only looks like one of these.
 *
 * YouTube (the same forms the product videos take, adr/0069 §8, the
 * backend's `lib/media/video/youtube.ts`):
 * - `youtube.com/watch?v={id}`, `/shorts/{id}`, `/embed/{id}` (`www.`, `m.`, bare)
 * - `youtu.be/{id}`
 * - `youtube-nocookie.com/embed/{id}` (`www.`, bare)
 *
 * Vimeo: `vimeo.com/{id}` (`www.`, bare) and `player.vimeo.com/video/{id}`.
 *
 * HTTPS or plain HTTP (only the id is kept); a link without a scheme is
 * read as HTTPS. Played from YouTube's privacy-enhanced player and Vimeo's
 * player with "do not track", only after the visitor presses the button.
 * The backend mirrors the parser (`lib/storefront/sections/hero-video.ts`;
 * a test runs both on the same links). Imports nothing at run time.
 */

export const HERO_VIDEO_LIMITS = {
  /** Longer than any real link to a video: refused before it is parsed. */
  url: 2048,
  /** The button's own words. */
  label: 40,
} as const

export type HeroVideoHost = "youtube" | "vimeo"

/** A video as the opening plays it: whose player, and the video's id there. */
export interface HeroVideoSource {
  host: HeroVideoHost
  id: string
}

/** The only two players the opening frames (the storefront policy's `frame-src`). */
export const HERO_VIDEO_PLAYERS: Readonly<Record<HeroVideoHost, string>> = {
  youtube: "https://www.youtube-nocookie.com/embed/",
  vimeo: "https://player.vimeo.com/video/",
}

/** A YouTube id: 11 characters of the URL-safe base64 alphabet; a Vimeo id: digits only. */
export const HERO_VIDEO_IDS: Readonly<Record<HeroVideoHost, RegExp>> = {
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
  return !rest.includes("/") && HERO_VIDEO_IDS[host].test(rest) ? rest : null
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
      return values.length === 1 && only !== undefined && HERO_VIDEO_IDS.youtube.test(only)
        ? only
        : null
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
export function heroVideoOf(input: unknown): HeroVideoSource | null {
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

/** What each player is asked once pressed: start at once; YouTube inline and its own channel's videos after, Vimeo without tracking. */
const PLAYER_QUERY: Readonly<Record<HeroVideoHost, string>> = {
  youtube: "?autoplay=1&playsinline=1&rel=0",
  vimeo: "?autoplay=1&dnt=1",
}

/**
 * The player's address for a video, built from its host and id alone;
 * null for a host or an id off the lists (the id is checked again here,
 * whoever built the source).
 */
export function heroVideoPlayerSrc(source: HeroVideoSource): string | null {
  const { host, id } = source
  if (!Object.hasOwn(HERO_VIDEO_PLAYERS, host) || !HERO_VIDEO_IDS[host].test(id)) {
    return null
  }
  return `${HERO_VIDEO_PLAYERS[host]}${id}${PLAYER_QUERY[host]}`
}
