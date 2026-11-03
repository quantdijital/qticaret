import { gzipSync } from "node:zlib"
import type { FakeShopifyData, FakeShopifyNode } from "./fake-server"

const urlset = (locs: readonly string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((loc) => `<url><loc>${loc}</loc></url>`)
    .join("")}</urlset>`

/**
 * The store's sitemap as Shopify serves one: an index naming a products
 * sitemap and a gzipped pages one, each listing the store's addresses;
 * with `foreign`, another site's sitemap and address too, to be left.
 */
export function sitemapFile(
  name: string,
  origin: string,
  data: FakeShopifyData,
  foreign = true
): Buffer | null {
  const elsewhere = (address: string) => (foreign ? [address] : [])
  const handles = (nodes: readonly FakeShopifyNode[]) =>
    nodes.map((node) => (typeof node["handle"] === "string" ? node["handle"] : "")).filter(Boolean)
  switch (name) {
    case "sitemap.xml":
      return Buffer.from(
        `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
          `${origin}/sitemap_products_1.xml`,
          `${origin}/sitemap_pages_1.xml.gz`,
          ...elsewhere("https://baska-site.example.com/sitemap.xml"),
        ]
          .map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`)
          .join("")}</sitemapindex>`
      )
    case "sitemap_products_1.xml":
      return Buffer.from(
        urlset([
          ...handles(data.products).map(
            (handle) => `${origin}/products/${encodeURIComponent(handle)}`
          ),
          ...handles(data.collections).map((handle) => `${origin}/collections/${handle}`),
          ...elsewhere("https://baska-site.example.com/products/x"),
        ])
      )
    case "sitemap_pages_1.xml.gz":
      return gzipSync(urlset(handles(data.pages).map((handle) => `${origin}/pages/${handle}`)))
    default:
      return null
  }
}
