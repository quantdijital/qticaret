import type { SigningKey } from "@/features/keys/api"

export type RotationStep = "create" | "prepare" | "switch" | "retire"

/**
 * The signing key rotation's next step (adr/0061 §4.5): a key to make, a
 * `next` one to prepare, the switch to it, the old one to retire. An old
 * key waiting to be retired comes first: one switch at a time.
 */
export function rotationStep(keys: readonly SigningKey[]): RotationStep {
  const has = (status: SigningKey["status"]) => keys.some((key) => key.status === status)
  if (!has("active") && !has("next")) {
    return "create"
  }
  if (has("previous")) {
    return "retire"
  }
  return has("next") ? "switch" : "prepare"
}
