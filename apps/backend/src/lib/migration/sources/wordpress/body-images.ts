import { uploadStem } from "../../../seo/legacy/files"
import { decodeEntities } from "../../text"
import type { WordpressContext } from "./context"
import type { WxrItem } from "./reader"

/**
 * The pictures inside a post's or page's body (adr/0042 Ek 2026-11-27):
 * which file of the old site an `<img>` shows, so the run can store it in
 * the media library and the body can point there. The media library's
 * own upload first (the block editor's `wp-image-<id>` class, a gallery's
 * `data-id`), its original file rather than a size WordPress cut from it
 * (`kapak-300x200.jpg`, `kapak-scaled.jpg`): matched by the upload's stem
 * (`lib/seo/legacy/files.ts`). Else the largest file the tag names
 * (`srcset`, a lazy loader's `data-src`), only on the old site's own host
 * (a CDN's copy of it, `i0.wp.com/<host>/…`, read as the site's): a
 * picture from anywhere else is left out and counted, as before.
 */

/** A body picture: the old file to fetch and its alt text. */
export interface BodyImage {
  src: string
  alt: string | null
}

/** Reads an `<img>` tag's attributes; none for a picture that does not move. */
export type ImageOf = (attributes: string) => BodyImage | null

// As content entries keep an image's alt (workflows/content/rules CONTENT_LIMITS)
const MAX_ALT = 300
const ATTRIBUTE = /([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g
const PHOTON = /^i[0-3]\.wp\.com$/
const ID = /^\d{1,12}$/

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "")
const isWeb = (address: string) => /^https?:\/\//i.test(address)

export function attributesOf(text: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const match of text.matchAll(ATTRIBUTE)) {
    const name = match[1]?.toLowerCase()
    if (name && !found.has(name)) {
      found.set(name, decodeEntities(match[2] ?? match[3] ?? match[4] ?? "").trim())
    }
  }
  return found
}

/** An alt text as one clean line within the content's bounds; none for none. */
function altText(raw: string | undefined): string | null {
  const text = (raw ?? "")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ALT)
    .trim()
  return text === "" ? null : text
}

/** The candidate in a `srcset` with the largest width (or density); none for an empty one. */
export function largestOf(srcset: string | undefined): string | undefined {
  let best: { url: string; size: number } | undefined
  for (const part of (srcset ?? "").split(",")) {
    const [url, descriptor = "1x"] = part.trim().split(/\s+/)
    const size = Number.parseFloat(descriptor)
    if (url && (!best || (Number.isFinite(size) && size > best.size))) {
      best = { url, size: Number.isFinite(size) ? size : 1 }
    }
  }
  return best?.url
}

/** A file path as its upload: decoded, lower case, without its size suffixes. */
export const uploadKey = (path: string) => {
  let decoded = path
  try {
    decoded = decodeURIComponent(path)
  } catch {
    // A broken escape: compared as written
  }
  return uploadStem(decoded.toLowerCase())
}

// Built once per export, as every body of it reads the same media library
const STEMS = new WeakMap<ReadonlyMap<string, WxrItem>, Map<string, WxrItem>>()

/** The media library's uploads by their file's stem, so any size of one finds its original. */
function uploadsByStem(attachments: ReadonlyMap<string, WxrItem>): Map<string, WxrItem> {
  const kept = STEMS.get(attachments)
  if (kept) {
    return kept
  }
  const byStem = new Map<string, WxrItem>()
  for (const attachment of attachments.values()) {
    if (isWeb(attachment.attachmentUrl) && URL.canParse(attachment.attachmentUrl)) {
      const key = uploadKey(new URL(attachment.attachmentUrl).pathname)
      if (!byStem.has(key)) {
        byStem.set(key, attachment)
      }
    }
  }
  STEMS.set(attachments, byStem)
  return byStem
}

/** An address the tag names, as a file on the old site; none for one elsewhere or no web address. */
export function onSite(raw: string | undefined, site: URL | null): URL | null {
  if (!raw || !site || raw.startsWith("data:")) {
    return null
  }
  let url: URL
  try {
    url = new URL(raw, site)
  } catch {
    return null
  }
  if (!/^https?:$/.test(url.protocol)) {
    return null
  }
  const host = bareHost(site.hostname)
  // A CDN serving the site's own file: `https://i0.wp.com/eski.example.com/wp-content/…`
  if (PHOTON.test(url.hostname)) {
    const [, first = "", ...rest] = url.pathname.split("/")
    if (bareHost(first) !== host) {
      return null
    }
    url = new URL(`${site.protocol}//${first}/${rest.join("/")}`)
  }
  if (bareHost(url.hostname) !== host || url.username !== "" || url.password !== "") {
    return null
  }
  url.search = ""
  url.hash = ""
  return url
}

const altOf = (attachment: WxrItem) => altText(attachment.meta.get("_wp_attachment_image_alt"))

/** How the bodies of this export read their pictures. */
export function bodyImagesOf(context: Pick<WordpressContext, "attachments" | "wxr">): ImageOf {
  const site = context.wxr.site
  return (text) => {
    const attributes = attributesOf(text)
    const own = altText(attributes.get("alt"))
    const id = [
      /(?:^|\s)wp-image-(\d+)(?:\s|$)/.exec(attributes.get("class") ?? "")?.[1],
      attributes.get("data-id"),
      attributes.get("data-attachment-id"),
    ].find((value) => value && ID.test(value))
    const attachment = id ? context.attachments.get(id) : undefined
    if (attachment && isWeb(attachment.attachmentUrl)) {
      return { src: attachment.attachmentUrl, alt: own ?? altOf(attachment) }
    }
    const candidates = [
      attributes.get("data-orig-file"),
      attributes.get("data-large-file"),
      largestOf(attributes.get("data-srcset") ?? attributes.get("data-lazy-srcset")),
      largestOf(attributes.get("srcset")),
      attributes.get("data-src"),
      attributes.get("data-lazy-src"),
      attributes.get("src"),
    ].flatMap((raw) => onSite(raw, site) ?? [])
    const byStem = uploadsByStem(context.attachments)
    const [first] = candidates
    if (!first) {
      return null
    }
    for (const url of candidates) {
      const upload = byStem.get(uploadKey(url.pathname))
      if (upload) {
        return { src: upload.attachmentUrl, alt: own ?? altOf(upload) }
      }
    }
    return { src: first.href, alt: own }
  }
}
