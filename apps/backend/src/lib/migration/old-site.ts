import { gunzipSync } from "node:zlib"
import { ValidationError } from "../errors"
import { readCsv } from "../security/csv-read"
import { parseXmlSafely } from "../security/xml"
import { readZipSafely } from "../security/zip"

/**
 * The old site's own lists of its addresses (F14.7, adr/0042 §8): its
 * sitemap and Search Console's top pages. Read as untrusted files: the
 * secure XML, CSV and zip readers, sizes capped before and after a gzip.
 */

/** A sitemap file, gzipped or not, as protocol allows: 50 MB unpacked. */
export const MAX_SITEMAP_BYTES = 50 * 1024 * 1024

/** The file's text: a gzipped one unpacked within the cap. */
export function sitemapText(bytes: Buffer): string {
  const packed = bytes[0] === 0x1f && bytes[1] === 0x8b
  try {
    const plain = packed ? gunzipSync(bytes, { maxOutputLength: MAX_SITEMAP_BYTES }) : bytes
    return plain.toString("utf8").replace(/^\uFEFF/, "")
  } catch {
    throw new ValidationError("migration.sitemap_invalid")
  }
}

/** A sitemap's addresses, or an index's sitemaps (sitemaps.org protocol). */
export function sitemapEntries(text: string): { index: boolean; locs: string[] } {
  let parsed: unknown
  try {
    parsed = parseXmlSafely(text, {
      maxBytes: MAX_SITEMAP_BYTES,
      isArray: (tag) => tag === "url" || tag === "sitemap",
    })
  } catch {
    throw new ValidationError("migration.sitemap_invalid")
  }
  const root = parsed as {
    urlset?: { url?: { loc?: unknown }[] }
    sitemapindex?: { sitemap?: { loc?: unknown }[] }
  }
  const locsOf = (items: { loc?: unknown }[] | undefined) =>
    (items ?? [])
      .map((item) => (typeof item.loc === "string" ? item.loc.trim() : ""))
      .filter((loc) => loc !== "")
  if (root.sitemapindex) {
    return { index: true, locs: locsOf(root.sitemapindex.sitemap) }
  }
  if (root.urlset) {
    return { index: false, locs: locsOf(root.urlset.url) }
  }
  throw new ValidationError("migration.sitemap_invalid")
}

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "")

/** Whether an address is on the old site: its host, with or without `www.`. */
export function onSite(address: string, site: URL): boolean {
  try {
    const url = new URL(address)
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      bareHost(url.hostname) === bareHost(site.hostname)
    )
  } catch {
    return false
  }
}

// Search Console exports a thousand rows; a property's own export a few more
const MAX_ROWS = 50_000
const PAGE_COLUMN = /^(top pages|pages?|en çok tıklanan sayfalar|sayfalar?|url)$/i
const CLICKS_COLUMN = /^(clicks|tıklamalar|tıklama)$/i
const PAGES_FILE = /(^|\/)(pages|sayfalar)\.csv$/i

/**
 * The page rows of a Search Console performance export (Turkish or
 * English headers): the export's zip or its pages CSV alone.
 */
export async function searchConsolePages(
  bytes: Buffer
): Promise<{ url: string; clicks: number }[]> {
  let text: string
  if (bytes.subarray(0, 4).toString("latin1") === "PK\u0003\u0004") {
    const entries = await readZipSafely(bytes)
    const pages = entries.find((entry) => PAGES_FILE.test(entry.name))
    if (!pages) {
      throw new ValidationError("migration.search_console_invalid")
    }
    text = pages.data.toString("utf8")
  } else {
    text = bytes.toString("utf8")
  }
  const read = readCsv(text.replace(/^\uFEFF/, ""), { maxRows: MAX_ROWS, maxCells: 20 })
  if (!read.ok) {
    throw new ValidationError("migration.search_console_invalid")
  }
  const page = read.header.findIndex((name) => PAGE_COLUMN.test(name.trim()))
  const clicks = read.header.findIndex((name) => CLICKS_COLUMN.test(name.trim()))
  if (page === -1 || clicks === -1) {
    throw new ValidationError("migration.search_console_invalid")
  }
  return read.rows.flatMap((row) => {
    const url = row.cells[page]?.trim() ?? ""
    const count = Number((row.cells[clicks] ?? "").replace(/[^\d]/g, ""))
    return url === "" ? [] : [{ url, clicks: Number.isFinite(count) ? count : 0 }]
  })
}
