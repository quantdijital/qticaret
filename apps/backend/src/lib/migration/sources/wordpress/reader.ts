import { randomBytes } from "node:crypto"
import { ValidationError, isValidationError } from "../../../errors"
import { parseXmlSafely } from "../../../security/xml"
import { decodeEntities } from "../../text"
import { HEAD_BYTES, MAX_WXR_BYTES, NAMESPACE } from "./file"

/**
 * A WordPress export (WXR 1.0–1.2, Tools > Export) read as the untrusted
 * file it is (docs/04): the secure XML reader (no DTD, no entities, size
 * and depth caps), every value kept as text. Its CDATA sections (bodies,
 * names, serialized meta) are set aside before the reader sees the file:
 * the HTML in them is no XML, and its unclosed `<img>` and `<br>` would
 * count as nesting. Nothing in the file is run or evaluated. Only what the
 * migration needs is read: authors by their display name, never e-mails;
 * comments without their writers' e-mail or IP address.
 */

export interface WxrTermRef {
  /** The taxonomy: `product_cat`, `pa_celik`, `post_tag`. */
  domain: string
  slug: string
  name: string
}

export interface WxrComment {
  id: string
  author: string
  date: Date | null
  content: string
  /** `1` shown, `0` waiting, else spam or trash. */
  approved: string
  type: string
  meta: ReadonlyMap<string, string>
}

export interface WxrItem {
  id: string
  type: string
  status: string
  title: string
  /** Its address on the old site as the export wrote it. */
  link: string
  slug: string
  parent: string
  order: number
  date: Date | null
  content: string
  excerpt: string
  author: string | null
  password: boolean
  terms: WxrTermRef[]
  meta: ReadonlyMap<string, string>
  comments: WxrComment[]
  attachmentUrl: string
}

export interface WxrTerm {
  id: string
  taxonomy: string
  slug: string
  /** The parent's slug; "" at the top. */
  parent: string
  name: string
  description: string
  meta: ReadonlyMap<string, string>
}

export interface Wxr {
  /** The old site (`wp:base_site_url`): its host names the source. */
  site: URL | null
  siteName: string
  terms: WxrTerm[]
  items: WxrItem[]
}

const invalid = (cause?: unknown) =>
  new ValidationError("migration.wordpress_invalid", cause === undefined ? {} : { cause })

/** The text with each CDATA section swapped for a marker no file can guess, and how to put them back. */
function setAsideCdata(text: string): { xml: string; restore: (raw: string) => string } {
  const nonce = randomBytes(8).toString("hex")
  const kept: string[] = []
  const parts: string[] = []
  let at = 0
  for (;;) {
    const start = text.indexOf("<![CDATA[", at)
    if (start === -1) {
      parts.push(text.slice(at))
      break
    }
    const end = text.indexOf("]]>", start + 9)
    if (end === -1) {
      throw invalid()
    }
    parts.push(text.slice(at, start), `@@${nonce}:${String(kept.length)}@@`)
    kept.push(text.slice(start + 9, end))
    at = end + 3
  }
  const marker = new RegExp(`@@${nonce}:(\\d+)@@`, "g")
  return {
    xml: parts.join(""),
    restore: (raw) =>
      raw.includes("@@") ? raw.replace(marker, (_, n: string) => kept[Number(n)] ?? "") : raw,
  }
}

type XmlNode = Record<string, unknown>

const isNode = (value: unknown): value is XmlNode =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const nodes = (value: unknown): XmlNode[] =>
  Array.isArray(value) ? value.filter(isNode) : isNode(value) ? [value] : []

const rawOf = (value: unknown): string =>
  typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : isNode(value)
        ? rawOf(value["#text"])
        : ""

/** A percent-encoded slug (`%c3%a7ak%c4%b1`) as letters; a broken escape as written. */
function decoded(slug: string): string {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

/** WordPress's "2026-03-02 08:54:02" (GMT); a draft's zero date is none. */
function dateOf(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(text.trim())
  if (!match || match[1] === "0000") {
    return null
  }
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number)
  const date = new Date(
    Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, second ?? 0)
  )
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * The export's terms, items and site. A file that is no WordPress export,
 * or breaks the reader's rules, is refused as a whole.
 */
export function readWxr(text: string): Wxr {
  if (Buffer.byteLength(text, "utf8") > MAX_WXR_BYTES) {
    throw new ValidationError("migration.wordpress_too_large")
  }
  if (!NAMESPACE.test(text.slice(0, HEAD_BYTES))) {
    throw invalid()
  }
  const { xml, restore } = setAsideCdata(text)
  let parsed: unknown
  try {
    parsed = parseXmlSafely(xml, {
      maxBytes: MAX_WXR_BYTES,
      keepAttributes: true,
      isArray: (tag) => REPEATED.has(tag),
    })
  } catch (error) {
    throw isValidationError(error) ? invalid(error) : error
  }
  const rss = isNode(parsed) ? parsed["rss"] : undefined
  const channel = isNode(rss) ? rss["channel"] : undefined
  if (!isNode(channel) || channel["wp:wxr_version"] === undefined) {
    throw invalid()
  }
  // Raw text, a CDATA's own; a name or title with its entities read
  const raw = (value: unknown) => restore(rawOf(value))
  const plain = (value: unknown) => decodeEntities(raw(value)).trim()
  const metaOf = (list: unknown) => {
    const meta = new Map<string, string>()
    for (const entry of nodes(list)) {
      const key = plain(entry["wp:meta_key"])
      if (key !== "" && !meta.has(key)) {
        meta.set(key, raw(entry["wp:meta_value"]))
      }
    }
    return meta
  }
  const authors = new Map(
    nodes(channel["wp:author"]).map((author) => [
      plain(author["wp:author_login"]),
      plain(author["wp:author_display_name"]),
    ])
  )
  const term = (
    node: XmlNode,
    taxonomy: string,
    keys: readonly [string, string, string, string]
  ) => ({
    id: plain(node["wp:term_id"]),
    taxonomy,
    slug: decoded(plain(node[keys[0]])),
    parent: decoded(plain(node[keys[1]])),
    name: plain(node[keys[2]]),
    description: raw(node[keys[3]]),
    meta: metaOf(node["wp:termmeta"]),
  })
  const terms: WxrTerm[] = [
    ...nodes(channel["wp:category"]).map((node) =>
      term(node, "category", [
        "wp:category_nicename",
        "wp:category_parent",
        "wp:cat_name",
        "wp:category_description",
      ])
    ),
    ...nodes(channel["wp:tag"]).map((node) =>
      term(node, "post_tag", ["wp:tag_slug", "", "wp:tag_name", "wp:tag_description"])
    ),
    ...nodes(channel["wp:term"]).map((node) =>
      term(node, plain(node["wp:term_taxonomy"]), [
        "wp:term_slug",
        "wp:term_parent",
        "wp:term_name",
        "wp:term_description",
      ])
    ),
  ]
  const items: WxrItem[] = nodes(channel["item"]).map((item) => {
    const creator = plain(item["dc:creator"])
    return {
      id: plain(item["wp:post_id"]),
      type: plain(item["wp:post_type"]),
      status: plain(item["wp:status"]),
      title: plain(item["title"]),
      link: plain(item["link"]),
      slug: decoded(plain(item["wp:post_name"])),
      parent: plain(item["wp:post_parent"]),
      order: Number(plain(item["wp:menu_order"])) || 0,
      date: dateOf(plain(item["wp:post_date_gmt"])) ?? dateOf(plain(item["wp:post_date"])),
      content: raw(item["content:encoded"]),
      excerpt: raw(item["excerpt:encoded"]),
      author: (authors.get(creator) ?? "") || null,
      password: plain(item["wp:post_password"]) !== "",
      terms: nodes(item["category"]).map((category) => ({
        domain: decodeEntities(rawOf(category["@_domain"])),
        slug: decoded(decodeEntities(rawOf(category["@_nicename"]))),
        name: plain(category),
      })),
      meta: metaOf(item["wp:postmeta"]),
      comments: nodes(item["wp:comment"]).map((comment) => ({
        id: plain(comment["wp:comment_id"]),
        author: plain(comment["wp:comment_author"]),
        date:
          dateOf(plain(comment["wp:comment_date_gmt"])) ??
          dateOf(plain(comment["wp:comment_date"])),
        content: raw(comment["wp:comment_content"]),
        approved: plain(comment["wp:comment_approved"]),
        type: plain(comment["wp:comment_type"]),
        meta: metaOf(comment["wp:commentmeta"]),
      })),
      attachmentUrl: plain(item["wp:attachment_url"]),
    }
  })
  const siteUrl = plain(channel["wp:base_site_url"]) || plain(channel["link"])
  const site = URL.canParse(siteUrl) ? new URL(siteUrl) : null
  return { site, siteName: plain(channel["title"]), terms, items }
}

// Elements a WXR repeats: always lists, one or many
const REPEATED: ReadonlySet<string> = new Set([
  "item",
  "category",
  "wp:postmeta",
  "wp:comment",
  "wp:commentmeta",
  "wp:term",
  "wp:category",
  "wp:tag",
  "wp:termmeta",
  "wp:author",
])
