import type { MyProfile } from "@/features/settings/api/account"

/**
 * The signed-in member's own account, as the Hesabım tab shows and checks
 * it (the owner, 2026-11-06). The server decides again on every change.
 */

type Profile = MyProfile["profile"]

// docs/04, adr/0043: length first, ten characters at least (the server decides the rest)
export const MIN_PASSWORD = 10
export const MAX_PASSWORD = 256

/** The member's full name, or their address while they have none. */
export const fullNameOf = (profile: Profile): string =>
  [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || profile.email

/** Two letters for the avatar: first and last name's, or the address's first. */
export function initialsOf(profile: Profile): string {
  const parts = [profile.first_name, profile.last_name]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
  const letters = parts.length > 0 ? parts : [profile.email]
  return letters.map((part) => part.slice(0, 1).toLocaleUpperCase("tr")).join("")
}

/** The new password's own mistake, said before the server is asked. */
export function newPasswordIssue(values: {
  current: string
  next: string
  repeat: string
}): "short" | "long" | "same" | "mismatch" | null {
  const length = Array.from(values.next).length
  if (length < MIN_PASSWORD) {
    return "short"
  }
  if (length > MAX_PASSWORD) {
    return "long"
  }
  if (values.next === values.current) {
    return "same"
  }
  return values.next === values.repeat ? null : "mismatch"
}
