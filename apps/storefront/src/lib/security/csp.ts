/**
 * The storefront's Content Security Policy (docs/04, adr/0046 §4): scripts
 * only with this request's nonce (and what they load, `strict-dynamic`),
 * nothing framed but a card provider's form, YouTube's privacy-enhanced
 * player and Vimeo's player, no plugins, forms only to ourselves. Pictures may come
 * from any HTTPS host: product images live on the file storage or a CDN;
 * a product's videos likewise (`media-src`, adr/0069 §5).
 * Development relaxes what Next's dev server needs (eval, inline styles,
 * its websocket); a nonce makes browsers ignore 'unsafe-inline', so dev
 * styles go without one.
 */
/**
 * Inline style attributes the server's HTML may carry, by hash
 * (`'unsafe-hashes'`, sha256 of the attribute's exact value, base64):
 * Radix's navigation menu wraps its list in `style="position:relative"`
 * and marks each closed dropdown `style="pointer-events:none"`. Any other
 * attribute stays refused; our own code writes none (docs/19 §6).
 */
export const RADIX_STYLE_HASHES = [
  // position:relative
  "'sha256-KpSV7LuPYEu58+3u9LJr9v5Drm0uIKEv0h3u/+NVNm8='",
  // pointer-events:none (docs/21: six refusals a page, Best Practices 92)
  "'sha256-1OjyRYLAOH1vhXLUN4bBHal0rWxuwBDBP220NNc0CNU='",
]

/**
 * YouTube's privacy-enhanced player (adr/0069 §7, §8): the one source a
 * product's YouTube video is framed from, its `/embed/` path alone
 * (security review N1), and only after the visitor presses play (the
 * theme adds the frame then). The player's own
 * requests (scripts, images, streams) are its own document's, under its
 * own policy: nothing of YouTube's is opened in ours but this frame.
 */
export const YOUTUBE_PLAYER_SOURCE = "https://www.youtube-nocookie.com/embed/"

/**
 * Vimeo's player: the full image opening's video button may play a Vimeo
 * video (`@qticaret/types/hero-video`), framed from its `/video/` path
 * alone and only once the visitor presses the button. As with YouTube's,
 * the player's own requests are its own document's: nothing else of
 * Vimeo's is opened in ours.
 */
export const VIMEO_PLAYER_SOURCE = "https://player.vimeo.com/video/"

/**
 * Cloudflare Turnstile (adr/0044 Ek 2026-11-24): its script, loaded by our
 * nonce'd code only on a form that wants a token (`strict-dynamic` trusts
 * it; the host is for browsers without), and the widget's frame. Its
 * guidance names these two directives only.
 */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com"

export interface FrameRules {
  /** Card providers' own pages a form may lead to (a checkout without script follows a 303 there). */
  formOrigins?: readonly string[]
  /** Card providers' hosted forms the checkout frames (D7); nothing else is framed. */
  frameOrigins?: readonly string[]
  /**
   * The page may sit in a frame of our own: a card provider may load its
   * return address inside its own form, which is framed on the checkout.
   */
  framedBySelf?: boolean
  /** Other origins that may frame the page: the panel's theme editor, on preview pages only (adr/0049). */
  framedBy?: readonly string[]
  /**
   * The measurement tags the shop connected (docs/20 "vitrin dönüşüm
   * olayları"): their hosts are opened only then. Whether a visitor gets
   * the tag is their cookie answer's; the policy only allows it.
   */
  tags?: { google: boolean; meta: boolean }
}

/**
 * The tags' hosts (Google's and Meta's CSP guidance): their loaders in
 * `script-src` for browsers without `strict-dynamic` (the others trust
 * what our nonce'd code loads), and where they send what they measure.
 * Pictures are already allowed from any HTTPS host.
 */
const TAG_HOSTS = {
  google: {
    script: ["https://www.googletagmanager.com"],
    connect: [
      "https://www.googletagmanager.com",
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
    ],
  },
  meta: {
    script: ["https://connect.facebook.net"],
    connect: ["https://connect.facebook.net", "https://www.facebook.com"],
  },
}

export function contentSecurityPolicy(
  nonce: string,
  development: boolean,
  {
    frameOrigins = [],
    framedBySelf = false,
    formOrigins = [],
    framedBy = [],
    tags = { google: false, meta: false },
  }: FrameRules = {}
): string {
  const ancestors = [...(framedBySelf ? ["'self'"] : []), ...framedBy]
  const hosts = [...(tags.google ? [TAG_HOSTS.google] : []), ...(tags.meta ? [TAG_HOSTS.meta] : [])]
  const tagScripts = hosts
    .flatMap((each) => each.script)
    .map((host) => ` ${host}`)
    .join("")
  const tagConnects = hosts
    .flatMap((each) => each.connect)
    .map((host) => ` ${host}`)
    .join("")
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE_ORIGIN}${tagScripts}${development ? " 'unsafe-eval'" : ""}`,
    development ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    ...(development ? [] : [`style-src-attr 'unsafe-hashes' ${RADIX_STYLE_HASHES.join(" ")}`]),
    `img-src 'self' data: blob: https:${development ? " http:" : ""}`,
    // A product's clips (adr/0069 §5) come from the file storage or a CDN, as its pictures do
    `media-src 'self' https:${development ? " http:" : ""}`,
    "font-src 'self'",
    `connect-src 'self'${tagConnects}${development ? " ws: http://localhost:*" : ""}`,
    // A product's YouTube video (adr/0069 §8) and the opening's video (YouTube or Vimeo), framed
    // only once pressed; Turnstile's widget; the card providers' forms
    `frame-src ${[YOUTUBE_PLAYER_SOURCE, VIMEO_PLAYER_SOURCE, TURNSTILE_ORIGIN, ...frameOrigins].join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self'${formOrigins.length > 0 ? ` ${formOrigins.join(" ")}` : ""}`,
    `frame-ancestors ${ancestors.length > 0 ? ancestors.join(" ") : "'none'"}`,
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ]
  return directives.join("; ")
}

/** A fresh nonce per response: 128 random bits, base64. */
export function newNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}
