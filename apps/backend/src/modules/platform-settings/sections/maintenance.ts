import { z } from "@medusajs/framework/zod"
import { unknownShopTokens } from "../../../lib/shop/tokens"
import { defineSection, isCleanText } from "./define"

const MAX_ALLOW_PATHS = 20
const MAX_PATH_LENGTH = 200

/**
 * Maintenance or "coming soon" (adr/0053): while on, the storefront answers
 * every page with 503, `Retry-After` and a plain page, but for its system
 * paths (preview, the payment providers' return, robots, sitemaps, the
 * IndexNow key), the paths the shop leaves open and visitors holding a
 * bypass link. The owner's alone to write: it is where the shop goes dark.
 */
export interface MaintenanceSettings {
  enabled: boolean
  /** The plain page's heading; none: the storefront's own ("Kısa bir aradayız"). */
  title: string | null
  /** A line under it; may stand for the shop's details (`{telefon}`, adr/0048). */
  message: string | null
  /** When the shop expects to be back (ISO 8601 with offset); feeds `Retry-After`. */
  expected_at: string | null
  /**
   * Shop paths open while dark, besides the system ones: exact (`/iletisim`)
   * or a path and everything below it (`/sozlesmeler/*`). Lower case, no
   * trailing slash, no query.
   */
  allow_paths: string[]
}

const cleanText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => isCleanText(value), { message: "platform_settings.text_invalid" })

// The storefront 301s a trailing slash away (adr/0046 §4a): `/blog/` is `/blog`
const normalizedPath = (value: string): string => {
  const below = value.endsWith("/*")
  const base = below ? value.slice(0, -2) : value
  const trimmed = base.length > 1 ? base.replace(/\/+$/, "") : base
  return below ? `${trimmed}/*` : trimmed
}

// A path of this shop: never another host (`//`), a backslash, a query, a
// fragment or a `*` but as the closing `/*`; `/*` alone would open everything
const isAllowPath = (value: string): boolean => {
  const base = value.endsWith("/*") ? value.slice(0, -2) : value
  return (
    value.length <= MAX_PATH_LENGTH &&
    isCleanText(value) &&
    base.startsWith("/") &&
    !base.startsWith("//") &&
    !/[\s\\?#*]/.test(base) &&
    !base.split("/").some((segment) => segment === "." || segment === "..")
  )
}

const allowPath = z
  .string()
  .trim()
  .toLowerCase()
  .transform(normalizedPath)
  .refine(isAllowPath, { message: "platform_settings.url_invalid" })

export const maintenanceSection = defineSection<MaintenanceSettings>(
  "maintenance",
  {
    enabled: z.boolean(),
    title: cleanText(80).nullable(),
    message: cleanText(600)
      .refine((value) => unknownShopTokens(value).length === 0, {
        message: "platform_settings.token_unknown",
      })
      .nullable(),
    expected_at: z.iso
      .datetime({ offset: true, message: "platform_settings.date_invalid" })
      .nullable(),
    allow_paths: z
      .array(allowPath)
      .max(MAX_ALLOW_PATHS)
      .transform((paths) => [...new Set(paths)]),
  },
  { enabled: false, title: null, message: null, expected_at: null, allow_paths: [] }
)
