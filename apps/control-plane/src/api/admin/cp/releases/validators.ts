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
      .regex(RELEASE_VERSION, "cp.release_version_invalid"),
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
    release_id: z.string().min(1).max(64).nullable(),
    reason: z
      .string()
      .trim()
      .min(TARGET_REASON_MIN, "cp.reason_required")
      .max(TARGET_REASON_MAX)
      .regex(CLEAN_TEXT, "cp.text_invalid"),
  })
  .strict()
export type PostTargetReleaseType = z.infer<typeof PostTargetRelease>
