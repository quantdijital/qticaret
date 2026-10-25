/**
 * Sitemap files (docs/13 §6): a `urlset` per kind of page, split at 50,000
 * URLs or 45 MB (under Google's 50 MB), product images in the image
 * extension, and an index naming every file. Pure: the caller lists the
 * pages. `priority` and `changefreq` are left out (Google ignores them).
 */

export interface SitemapEntry {
  /** Absolute. */
  loc: string
  lastmod: Date | null
  /** Absolute; at most 1,000 per URL. */
  images?: string[]
}

export interface SitemapFile {
  name: string
  content: string
  urls: number
}

export const SITEMAP_LIMITS = { urls: 50_000, bytes: 45 * 1024 * 1024, images: 1_000 } as const

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n'
const URLSET_OPEN =
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
const URLSET_CLOSE = "</urlset>\n"

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
}

export const escapeXml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)

// W3C datetime, day precision is enough and stable across regenerations
const day = (date: Date): string => date.toISOString().slice(0, 10)

function urlXml(entry: SitemapEntry): string {
  const images = (entry.images ?? [])
    .slice(0, SITEMAP_LIMITS.images)
    .map((image) => `<image:image><image:loc>${escapeXml(image)}</image:loc></image:image>`)
    .join("")
  const lastmod = entry.lastmod ? `<lastmod>${day(entry.lastmod)}</lastmod>` : ""
  return `<url><loc>${escapeXml(entry.loc)}</loc>${lastmod}${images}</url>\n`
}

/** One kind of page as numbered files (`sitemap-products-1.xml`), none when it has no pages. */
export function urlsetFiles(kind: string, entries: readonly SitemapEntry[]): SitemapFile[] {
  const files: SitemapFile[] = []
  let body: string[] = []
  let bytes = 0
  const close = () => {
    if (body.length > 0) {
      files.push({
        name: `sitemap-${kind}-${String(files.length + 1)}.xml`,
        content: XML_HEAD + URLSET_OPEN + body.join("") + URLSET_CLOSE,
        urls: body.length,
      })
    }
    body = []
    bytes = 0
  }
  const frame = Buffer.byteLength(XML_HEAD + URLSET_OPEN + URLSET_CLOSE)
  for (const entry of entries) {
    const xml = urlXml(entry)
    const size = Buffer.byteLength(xml)
    if (body.length >= SITEMAP_LIMITS.urls || frame + bytes + size > SITEMAP_LIMITS.bytes) {
      close()
    }
    body.push(xml)
    bytes += size
  }
  close()
  return files
}

/** The index the storefront serves at `/sitemap.xml`, naming each file by its public address. */
export function sitemapIndex(
  files: readonly { name: string; lastmod: Date }[],
  origin: string
): string {
  const items = files
    .map(
      (file) =>
        `<sitemap><loc>${escapeXml(`${origin}/${file.name}`)}</loc><lastmod>${day(file.lastmod)}</lastmod></sitemap>\n`
    )
    .join("")
  return `${XML_HEAD}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}</sitemapindex>\n`
}
