import { z } from "zod"
import type { MigrationMode, Parcel } from "@/features/settings/api/migration"

/**
 * A WordPress + WooCommerce site's export (WXR) as a migration source
 * (adr/0042 Ek 2026-11-03, docs/entegrasyonlar/wordpress.md): what the
 * panel checks before sending it, the request that sends it, and the
 * report parts only this source has.
 */

/** The server's cap on the upload, and on the XML a zip holds. */
export const MAX_WXR_BYTES = 50 * 1024 * 1024
export const WXR_ACCEPT = ".xml,.zip,application/xml,text/xml,application/zip"
const ZIP_NAME = /\.zip$/i

export const isWxrName = (name: string) => /\.(?:xml|zip)$/i.test(name.trim())

/**
 * The type the server's CSRF rule takes on this path, from the file's name:
 * a browser's own may be none it takes (Windows calls a zip
 * `application/x-zip-compressed`).
 */
export const wxrContentType = (file: File) =>
  ZIP_NAME.test(file.name) ? "application/zip" : "application/xml"

/** A product category address base as the server takes it: one segment or none (`/urun-kategori/`, `/`). */
export const CATEGORY_BASE = /^\/?(?:[a-z0-9-]{1,60}\/?)?$/

/**
 * `POST /admin/migrations?source=wordpress`: the mode, the address base
 * when the owner names one (left out, the server reads it from the site's
 * own links), the parcel's four numbers when given.
 * A description refresh (ADR-0055) sends `refresh=descriptions` alone: it
 * reads neither the base nor the parcel.
 */
export function wordpressUploadPath(
  mode: MigrationMode,
  parcel: Parcel | null,
  categoryBase: string,
  refresh = false
): string {
  const query = new URLSearchParams({ source: "wordpress", mode })
  if (refresh) {
    query.set("refresh", "descriptions")
    return `/admin/migrations?${query.toString()}`
  }
  if (categoryBase.trim() !== "") {
    query.set("category_base", categoryBase.trim())
  }
  for (const [key, value] of Object.entries(parcel ?? {})) {
    query.set(key, String(value))
  }
  return `/admin/migrations?${query.toString()}`
}

const count = z.number().int().min(0)
const reportSchema = z.object({
  wordpress: z
    .object({
      /** Descriptive attributes (not used for variations): not moved until an attribute template exists. */
      attributes: z
        .array(z.object({ key: z.string(), name: z.string(), products: count, values: count }))
        .optional(),
      /** Named in the report, not moved: coupons, menu items, product tags, blog comments. */
      not_moved: z
        .object({
          coupons: count,
          menu_items: count,
          product_tags: count,
          blog_comments: count,
        })
        .partial()
        .optional(),
    })
    .optional(),
})

export type WordpressReport = NonNullable<z.infer<typeof reportSchema>["wordpress"]>
export type NotMovedKind = keyof NonNullable<WordpressReport["not_moved"]>
export const NOT_MOVED_KINDS: readonly NotMovedKind[] = [
  "coupons",
  "menu_items",
  "product_tags",
  "blog_comments",
]

/**
 * The WordPress parts of a run's summary, when the server sends them; the
 * counts every run has are read apart. Anything else reads as nothing.
 */
export const wordpressReportOf = (summary: unknown): WordpressReport =>
  reportSchema.safeParse(summary).data?.wordpress ?? {}

const refreshSchema = z.object({ refresh: z.array(z.string()) })

/** Whether a run only refreshed the descriptions of products moved before (ADR-0055). */
export const isDescriptionRefresh = (summary: unknown): boolean =>
  refreshSchema.safeParse(summary).data?.refresh.includes("descriptions") ?? false
