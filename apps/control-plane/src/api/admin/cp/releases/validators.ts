import { z } from "@medusajs/framework/zod"
import {
  RELEASE_COMMIT,
  RELEASE_NOTES_MAX,
  RELEASE_VERSION,
  RELEASE_VERSION_MAX,
  TARGET_REASON_MAX,
  TARGET_REASON_MIN,
} from "../../../../lib/fleet/releases"

/**
 * What the release routes take (Ek C18), strictly: a release's version,
 * commit and note; a shop's target and why.
 */

// Control and invisible format characters never make text; a note keeps its line breaks
const CLEAN_TEXT = /^(?:[^\p{Cc}\p{Cf}\u2028\u2029]|\n)*$/u

/** A release's id as the module makes it (`rel_` and a ULID). */
const RELEASE_ID = /^rel_[0-9A-Z]{26}$/

/** The e2e's pre-release (`0.0.0-e2e.<ms>`, lib/fleet/e2e-fleet.ts) and where it may be added. */
const E2E_PRERELEASE = "-e2e."
const E2E_ENVS = new Set(["development", "test"])

/** A note: plain text, Windows line breaks made plain, blank is none. */
const notes = z
  .string()
  .transform((value) => value.replace(/\r\n?/g, "\n").trim())
  .pipe(z.string().max(RELEASE_NOTES_MAX).regex(CLEAN_TEXT, "cp.text_invalid"))
  .transform((value) => (value === "" ? null : value))
  .nullable()

export const PostRelease = z
  .object({
    version: z
      .string()
      .trim()
      .max(RELEASE_VERSION_MAX)
      .regex(RELEASE_VERSION, "cp.release_version_invalid")
      // Review L1: the e2e's own shape, which its sweep removes, only where the e2e runs
      .refine(
        (value) => !value.includes(E2E_PRERELEASE) || E2E_ENVS.has(process.env["NODE_ENV"] ?? ""),
        "cp.release_version_reserved"
      ),
    // A hash pasted in capitals is the same commit
    commit: z
      .string()
      .trim()
      .transform((value) => value.toLowerCase())
      .pipe(z.string().regex(RELEASE_COMMIT, "cp.release_commit_invalid")),
    notes: notes.optional(),
  })
  .strict()
export type PostReleaseType = z.infer<typeof PostRelease>

/** A release's note: the only thing about it that changes. */
export const PostReleaseNotes = z.object({ notes }).strict()
export type PostReleaseNotesType = z.infer<typeof PostReleaseNotes>

/** A shop's target: a release, or null for none; why, always. */
export const PostTargetRelease = z
  .object({
    // Review I2: a release's id shape, or none
    release_id: z.string().regex(RELEASE_ID, "cp.release_unknown").nullable(),
    // Windows line breaks made plain, as a note's (review I2)
    reason: z
      .string()
      .transform((value) => value.replace(/\r\n?/g, "\n").trim())
      .pipe(
        z
          .string()
          .min(TARGET_REASON_MIN, "cp.reason_required")
          .max(TARGET_REASON_MAX)
          .regex(CLEAN_TEXT, "cp.text_invalid")
      ),
  })
  .strict()
export type PostTargetReleaseType = z.infer<typeof PostTargetRelease>
