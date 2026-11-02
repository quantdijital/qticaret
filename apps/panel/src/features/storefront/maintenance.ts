import { z } from "zod"
import { isCleanText, knownTokens, optionalLineSchema } from "@/features/settings/storefront"
import type { MaintenanceSettings } from "@/features/storefront/api/maintenance"
import { toLocalInput } from "@/features/storefront/layout/schedule"

/**
 * The maintenance form as the server takes it (backend
 * `platform-settings/sections/maintenance.ts`): the same limits and the same
 * path rule, so the owner sees a mistake before saving.
 */
export const MAINTENANCE_LIMITS = { title: 80, message: 600, paths: 20, pathLength: 200 } as const

const E = "storefront.maintenance.errors"
// A shutdown longer than this risks the shop's pages in search (adr/0053 §7)
const LONG_MS = 3 * 24 * 60 * 60_000

// The storefront 301s a trailing slash away: `/blog/` is `/blog`, `/blog/*` stays
export function normalizeAllowPath(value: string): string {
  const text = value.trim().toLowerCase()
  const below = text.endsWith("/*")
  const base = below ? text.slice(0, -2) : text
  const trimmed = base.length > 1 ? base.replace(/\/+$/, "") : base
  return below ? `${trimmed}/*` : trimmed
}

/** A path of this shop: never another host, a query, a fragment, `..`, or `*` but as the closing `/*`. */
export function isAllowPath(value: string): boolean {
  const base = value.endsWith("/*") ? value.slice(0, -2) : value
  return (
    value.length <= MAINTENANCE_LIMITS.pathLength &&
    isCleanText(value) &&
    base.startsWith("/") &&
    !base.startsWith("//") &&
    !/[\s\\?#*]/.test(base) &&
    !base.split("/").some((segment) => segment === "." || segment === "..")
  )
}

const pad = (value: number) => String(value).padStart(2, "0")

/**
 * A `datetime-local` value as the moment it names in the browser's own
 * time, written with its offset (`2026-11-10T09:00:00+03:00`); none when
 * empty or unreadable.
 */
export function toOffsetIso(local: string): string | null {
  if (local.trim() === "") {
    return null
  }
  const at = new Date(local)
  if (Number.isNaN(at.getTime())) {
    return null
  }
  const offset = -at.getTimezoneOffset()
  const sign = offset >= 0 ? "+" : "-"
  const hours = pad(Math.floor(Math.abs(offset) / 60))
  const minutes = pad(Math.abs(offset) % 60)
  return `${toLocalInput(at.toISOString())}:00${sign}${hours}:${minutes}`
}

/** Whether the expected return is far enough off to warn about search engines. */
export const isLongMaintenance = (expectedAt: string | null, now: number = Date.now()): boolean =>
  expectedAt !== null && new Date(expectedAt).getTime() - now > LONG_MS

export const maintenanceSchema = z.object({
  enabled: z.boolean(),
  title: optionalLineSchema(MAINTENANCE_LIMITS.title),
  message: optionalLineSchema(MAINTENANCE_LIMITS.message).refine(...knownTokens),
  expected_at: z.string().refine((value) => value === "" || toOffsetIso(value) !== null, {
    message: `${E}.dateInvalid`,
  }),
  allow_paths: z
    .array(
      z.object({
        path: z
          .string()
          .transform(normalizeAllowPath)
          .refine((value) => value !== "", `${E}.pathRequired`)
          .refine((value) => value === "" || isAllowPath(value), `${E}.pathInvalid`),
      })
    )
    .max(MAINTENANCE_LIMITS.paths),
})

export type MaintenanceValues = z.input<typeof maintenanceSchema>
export type MaintenanceParsed = z.output<typeof maintenanceSchema>

/** The stored section as the form holds it: empty fields for none, the moment in local time. */
export const maintenanceValuesOf = (saved: MaintenanceSettings): MaintenanceValues => ({
  enabled: saved.enabled,
  title: saved.title ?? "",
  message: saved.message ?? "",
  expected_at: toLocalInput(saved.expected_at),
  allow_paths: saved.allow_paths.map((path) => ({ path })),
})

const orNull = (value: string): string | null => (value === "" ? null : value)

/** The whole section as it is sent: none for an empty field, each path once. */
export const maintenanceBodyOf = (values: MaintenanceParsed): MaintenanceSettings => ({
  enabled: values.enabled,
  title: orNull(values.title),
  message: orNull(values.message),
  expected_at: toOffsetIso(values.expected_at),
  allow_paths: [...new Set(values.allow_paths.map(({ path }) => path))],
})
