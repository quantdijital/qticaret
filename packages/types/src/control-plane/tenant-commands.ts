import { z } from "zod"

/**
 * What the provisioner reads back from a shop's commands (adr/0061 §3.4,
 * §5.7, Ek C10). A command prints at most one result line on stdout:
 * `TENANT_RESULT_PREFIX` and a JSON object; everything else it prints is
 * its log. The provisioner reads only that line, and never keeps or logs
 * it: `tenant:invite-owner`'s carries the owner's invitation link.
 */
export const TENANT_RESULT_PREFIX = "QT_TENANT_RESULT "

/** The result line's longest form; a longer line is not read. */
export const TENANT_RESULT_MAX_LENGTH = 8 * 1024

/**
 * An invitation token as Medusa makes it (a JWT: base64url parts and dots).
 * Only the token crosses: the control plane builds the link itself from
 * the shop panel's known origin (C10 review M1), so a shop's output never
 * chooses where our e-mail points.
 */
export const INVITE_TOKEN = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){0,4}$/

/** `tenant:invite-owner email=`: a new invitation's token, or none because the shop already has staff. */
export const inviteOwnerResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("invited"),
      token: z.string().min(16).max(2048).regex(INVITE_TOKEN),
    })
    .strict(),
  z.object({ status: z.literal("owner_exists") }).strict(),
  // The address already has a user here: made outside the setup, it is not invited again
  z.object({ status: z.literal("address_taken") }).strict(),
])
export type InviteOwnerResult = z.infer<typeof inviteOwnerResultSchema>

/** `tenant:plan-import` (the first document, from stdin): as the push endpoint answers. */
export const planImportResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.enum(["applied", "same"]),
      serial: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    })
    .strict(),
  z.object({ status: z.literal("refused"), code: z.string().min(1).max(100) }).strict(),
  z.object({ status: z.literal("unmanaged") }).strict(),
])
export type PlanImportResult = z.infer<typeof planImportResultSchema>

const count = z.number().int().min(0).max(100_000)

/**
 * `tenant:apply-pack pack=` (Ek C12): the pack and version applied and what
 * became of its items this time: `added` new to the shop, `kept` the shop's
 * own left as they are, `skipped` with nothing to hang on (a removed parent).
 * Items offered before are not counted again. `unknown_pack`: this shop's
 * build has no such pack (an older release); it exits 1.
 */
export const applyPackResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("applied"),
      pack: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
      version: z.number().int().min(1).max(10_000),
      added: count,
      kept: count,
      skipped: count,
    })
    .strict(),
  z.object({ status: z.literal("unknown_pack") }).strict(),
])
export type ApplyPackResult = z.infer<typeof applyPackResultSchema>

/**
 * `tenant:apply-preset pack= preset= demo=` (adr/0063 §7): the preset and
 * version written into the design's draft, how many of its references the
 * shop had nothing for (`skipped`) and the sections left out (`dropped`),
 * whether the draft was published (only on a shop that has never published
 * a design: a new shop opens with the look). `unknown_preset`: this
 * shop's build has no such preset, or the shop was not given its pack; it exits 1.
 */
export const applyPresetResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("applied"),
      pack: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
      preset: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
      version: z.number().int().min(1).max(10_000),
      skipped: count,
      dropped: count,
      published: z.boolean(),
    })
    .strict(),
  z.object({ status: z.literal("unknown_preset") }).strict(),
])
export type ApplyPresetResult = z.infer<typeof applyPresetResultSchema>

/**
 * `tenant:load-samples pack=`: the pack's sample catalogue loaded into the
 * shop (the wizard's "Örnek ürünlerle başla"), every record marked as a
 * sample: how many products and categories it made, how many of the pack's
 * hidden categories it showed. `already_loaded`: the set is there already
 * (exits 0). `unknown_samples`: this build has no samples for the pack, or
 * the shop was not given the pack; it exits 0 too, so its reason is read.
 */
export const loadSamplesResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("loaded"),
      pack: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
      products: count,
      categories_made: count,
      categories_opened: count,
    })
    .strict(),
  z.object({ status: z.literal("already_loaded") }).strict(),
  z.object({ status: z.literal("unknown_samples") }).strict(),
])
export type LoadSamplesResult = z.infer<typeof loadSamplesResultSchema>

/** The line a command prints for `result`. */
export const tenantResultLine = (result: object): string =>
  `${TENANT_RESULT_PREFIX}${JSON.stringify(result)}`

/**
 * The result line in a command's stdout, parsed (the last one wins);
 * null when there is none, it is too long or it is not a JSON object.
 */
export function readTenantResult(stdout: string): unknown {
  const lines = stdout.split(/\r?\n/).filter((line) => line.startsWith(TENANT_RESULT_PREFIX))
  const line = lines.at(-1)
  if (line === undefined || line.length > TENANT_RESULT_MAX_LENGTH) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(line.slice(TENANT_RESULT_PREFIX.length))
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * `tenant:apply-profile` (stdin): the shop's details the control plane's
 * wizard took (its company and its owner), handed to the shop at setup so
 * the owner does not type them again. Only empty fields of the shop's
 * settings are filled; never a TCKN (a sole trader's number stays in the
 * control plane). Each field is optional; the shop checks each with its own
 * settings schema and leaves out one it refuses.
 */
export const tenantProfileSchema = z
  .object({
    legal: z
      .object({
        company_title: z.string().min(1).max(200).optional(),
        tax_office: z.string().min(1).max(100).optional(),
        /** A VKN (10 digits) only. */
        tax_number: z
          .string()
          .regex(/^\d{10}$/)
          .optional(),
        address: z.string().min(1).max(500).optional(),
      })
      .strict(),
    store: z
      .object({
        contact_email: z.string().min(3).max(254).optional(),
        contact_phone: z.string().min(3).max(32).optional(),
      })
      .strict(),
  })
  .strict()
export type TenantProfile = z.infer<typeof tenantProfileSchema>

/**
 * `tenant:apply-profile`'s result: how many fields it filled, how many the
 * shop already had (kept as they are) and how many its schemas refused.
 * Counts only: no value crosses back.
 */
export const applyProfileResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("applied"),
      filled: count,
      kept: count,
      refused: count,
    })
    .strict(),
  // Not a profile: nothing changed, it exits 1
  z.object({ status: z.literal("refused") }).strict(),
])
export type ApplyProfileResult = z.infer<typeof applyProfileResultSchema>
