import { z } from "@medusajs/framework/zod"
import { LIMIT_KEYS, TENANT_STATUSES, isPlatformFlag } from "@qticaret/types/control-plane"
import { isValidTckn, isValidVkn } from "@qticaret/server-kit"
import { COMPANY_KINDS, CONTACT_ROLES, NOTE_MAX } from "../../../../lib/tenants/kinds"
import { normalizePhone } from "../../../../lib/tenants/phone"
import { isKnownSectorPack } from "../../../../lib/tenants/sector-packs"
import { slugProblem } from "../../../../lib/tenants/slug"

// Control and invisible format characters never make a name or an address
const CLEAN = /^[^\p{Cc}\p{Cf}\u2028\u2029]*$/u
// A note keeps its line breaks
const CLEAN_TEXT = /^(?:[^\p{Cc}\p{Cf}]|[\n\r\t])*$/u

const name = z.string().trim().min(1, "cp.name_required").max(100).regex(CLEAN, "cp.name_invalid")
const id = z.string().min(1).max(64)

/** An optional text field: blank means "not known" (null), absent means "unchanged". */
const blankable = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(CLEAN, "cp.text_invalid")
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()

const digits = (check: (value: string) => boolean, message: string) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, ""))
    .refine((value) => value === "" || check(value), message)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()

export const GetTenants = z
  .object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(TENANT_STATUSES).optional(),
    package_id: id.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict()
export type GetTenantsType = z.infer<typeof GetTenants>

/** A new shop record: its name and slug (fixed), optionally its package and sector pack (C11). */
export const PostTenant = z
  .object({
    name,
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .superRefine((value, ctx) => {
        const problem = slugProblem(value)
        if (problem) {
          ctx.addIssue({ code: "custom", message: problem })
        }
      }),
    package_id: id.nullable().optional(),
    // C12: any pack this control plane has (packages/sector-packs)
    sector_pack: z
      .string()
      .max(40)
      .refine(isKnownSectorPack, "cp.sector_pack_unknown")
      .nullable()
      .optional(),
  })
  .strict()
export type PostTenantType = z.infer<typeof PostTenant>

/**
 * A new shop's address asked while typed (C11): either or both, each
 * bounded so a query cannot carry a long text to the database.
 */
export const GetTenantAvailability = z
  .object({
    slug: z.string().max(64).optional(),
    hostname: z.string().trim().min(1).max(253).optional(),
  })
  .strict()
export type GetTenantAvailabilityType = z.infer<typeof GetTenantAvailability>

export const PostTenantUpdate = z.object({ name }).strict()
export type PostTenantUpdateType = z.infer<typeof PostTenantUpdate>

/** The company, field by field: absent unchanged, blank cleared. */
export const PostCompany = z
  .object({
    kind: z.enum(COMPANY_KINDS).optional(),
    legal_name: blankable(200),
    tax_office: blankable(100),
    tax_number: digits(isValidVkn, "cp.vkn_invalid"),
    tckn: digits(isValidTckn, "cp.tckn_invalid"),
    address_line: blankable(300),
    district: blankable(100),
    city: blankable(100),
    postal_code: digits((value) => /^\d{5}$/.test(value), "cp.postal_code_invalid"),
  })
  .strict()
export type PostCompanyType = z.infer<typeof PostCompany>

export const PostContact = z
  .object({
    name,
    role: z.enum(CONTACT_ROLES),
    email: z
      .email({ error: "cp.email_invalid" })
      .max(254)
      .transform((value) => value.trim().toLowerCase()),
    phone: z
      .string()
      .max(40)
      .transform((value, ctx) => {
        if (value.trim() === "") {
          return null
        }
        const phone = normalizePhone(value)
        if (!phone) {
          ctx.addIssue({ code: "custom", message: "cp.phone_invalid" })
          return z.NEVER
        }
        return phone
      })
      .nullable()
      .optional(),
    is_primary_billing: z.boolean().optional(),
  })
  .strict()
export type PostContactType = z.infer<typeof PostContact>

export const PostDomain = z.object({ hostname: z.string().trim().min(1).max(253) }).strict()
export type PostDomainType = z.infer<typeof PostDomain>

const noteBody = z
  .string()
  .trim()
  .min(1, "cp.note_required")
  .max(NOTE_MAX, "cp.note_too_long")
  .regex(CLEAN_TEXT, "cp.text_invalid")

export const PostNote = z.object({ body: noteBody, pinned: z.boolean().optional() }).strict()
export type PostNoteType = z.infer<typeof PostNote>

export const PostNoteUpdate = z
  .object({ body: noteBody.optional(), pinned: z.boolean().optional() })
  .strict()
  .refine((value) => value.body !== undefined || value.pinned !== undefined, "cp.nothing_to_save")
export type PostNoteUpdateType = z.infer<typeof PostNoteUpdate>

/** The package a shop is on; null takes it off its package. */
export const PostTenantPlan = z.object({ package_id: id.nullable() }).strict()
export type PostTenantPlanType = z.infer<typeof PostTenantPlan>

/** A limit value: a whole count or megabytes, null for no limit. */
export const limitValue = z.number().int().min(0).max(1_000_000_000).nullable()

/** An exception's reason: required, so the activity says why a shop differs from its package. */
const reason = z
  .string()
  .trim()
  .min(3, "cp.reason_required")
  .max(500)
  .regex(CLEAN_TEXT, "cp.text_invalid")

/** An exception's optional end; never already past. */
const expiresAt = z.iso
  .datetime({ offset: true })
  .refine((value) => new Date(value).getTime() > Date.now(), "cp.override_expired")
  .nullable()
  .optional()

export const PostOverride = z
  .object({ key: z.enum(LIMIT_KEYS), value: limitValue, reason, expires_at: expiresAt })
  .strict()
export type PostOverrideType = z.infer<typeof PostOverride>

/** A key of the shared platform flag list (Ek C9); any other is refused. */
export const platformFlagKey = z
  .string()
  .max(100)
  .refine((key) => isPlatformFlag(key, process.env["NODE_ENV"]), "cp.flag_unknown")

/** A shop's exception for one platform flag (Ek C9), beside the limits'. */
export const PostFeatureOverride = z
  .object({ key: platformFlagKey, enabled: z.boolean(), reason, expires_at: expiresAt })
  .strict()
export type PostFeatureOverrideType = z.infer<typeof PostFeatureOverride>

export const GetActivity = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    before: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
export type GetActivityType = z.infer<typeof GetActivity>
