import { z } from "@medusajs/framework/zod"
import { QUERY_POLICIES, REDIRECT_MATCHES, REDIRECT_STATUSES } from "../../../../lib/seo/redirects"
import type { RedirectStatus } from "../../../../lib/seo/redirects"
import { REDIRECT_ORIGINS } from "../../../../modules/seo-redirects/models/seo-redirect"

const isStatus = (value: number): value is RedirectStatus =>
  (REDIRECT_STATUSES as readonly number[]).includes(value)

const page = {
  q: z.string().trim().max(200).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}

/**
 * A rule as the panel sends it (adr/0017). Sources and targets are checked
 * in the workflow, where the shop's rules and pages are known; here only
 * shape and size. An update sends the whole rule.
 */
export const AdminPostRedirect = z
  .object({
    source: z.string().min(1).max(2048),
    match: z.enum(REDIRECT_MATCHES).default("exact"),
    target: z.string().max(2048).nullable().optional(),
    status: z
      .number()
      .int()
      .refine(isStatus, { message: "seo.redirect_status_invalid" })
      .default(301)
      .transform((value) => value),
    query_policy: z.enum(QUERY_POLICIES).default("keep"),
    query_keep: z.array(z.string().max(64)).max(20).optional(),
  })
  .strict()
export type AdminPostRedirectType = z.infer<typeof AdminPostRedirect>

export const REDIRECT_ORDERS = ["recent", "hits", "source"] as const

export const AdminGetRedirects = z
  .object({
    ...page,
    match: z.enum(REDIRECT_MATCHES).optional(),
    origin: z.enum(REDIRECT_ORIGINS).optional(),
    order: z.enum(REDIRECT_ORDERS).default("recent"),
  })
  .strict()
export type AdminGetRedirectsType = z.infer<typeof AdminGetRedirects>

/** A redirect file (≤ 1000 rows); a dry run by default, so the panel can show what it would do. */
export const AdminPostRedirectImport = z
  .object({
    csv: z.string().min(1).max(1_000_000),
    dry_run: z.boolean().default(true),
  })
  .strict()
export type AdminPostRedirectImportType = z.infer<typeof AdminPostRedirectImport>

/** `?path=`: where a storefront path goes now, as the storefront would be told. */
export const AdminGetSeoResolve = z.object({ path: z.string().min(1).max(2048) }).strict()
export type AdminGetSeoResolveType = z.infer<typeof AdminGetSeoResolve>

export const AdminGetOldPaths = z.object(page).strict()
export type AdminGetOldPathsType = z.infer<typeof AdminGetOldPaths>

export const AdminPostReleasePath = z.object({ path: z.string().min(1).max(2048) }).strict()
export type AdminPostReleasePathType = z.infer<typeof AdminPostReleasePath>

export const NOT_FOUND_ORDERS = ["hits", "recent"] as const

export const AdminGetNotFound = z
  .object({ ...page, order: z.enum(NOT_FOUND_ORDERS).default("hits") })
  .strict()
export type AdminGetNotFoundType = z.infer<typeof AdminGetNotFound>

const urlStyle = z.enum(["prefixed", "flat"])

/** `?product=flat&category=prefixed&brand=prefixed`: the URL style to check a move to. */
export const AdminGetUrlStyle = z
  .object({ product: urlStyle, category: urlStyle, brand: urlStyle })
  .strict()
export type AdminGetUrlStyleType = z.infer<typeof AdminGetUrlStyle>
