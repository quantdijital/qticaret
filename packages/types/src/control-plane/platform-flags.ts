import { FEATURE_FLAG_KEY } from "./registry"

/**
 * The `owner: platform` feature flags (adr/0012, adr/0061 Ek C9): the flags
 * a package sets and the plan document carries. The shop's registry
 * (`apps/backend` platform-settings `features.ts`) is the one that applies
 * them; a backend unit test holds this list and that registry to the same
 * keys and defaults, so the control plane can never offer a flag the shop
 * does not know, nor miss one it does. A new flag is added to both in one
 * change.
 */
export interface PlatformFlagDefinition {
  key: string
  /** What the shop uses without a document, and what a package without a value gets. */
  default: boolean
  /** Like the shop's test flags: present under NODE_ENV=test only. */
  testOnly?: true
}

export const PLATFORM_FLAGS: readonly PlatformFlagDefinition[] = Object.freeze([
  // Product videos (adr/0069 §12), the first business flag: on unless a package turns it off.
  // Added to the shops first, then offered by the control plane (docs/08 "Ekleme")
  { key: "catalog.product_videos", default: true },
  // The shop's test-only platform flag (`test.platform_sample`): the path proven end to end
  { key: "test.platform_sample", default: true, testOnly: true },
])

/** The platform flags in force under `nodeEnv` (the shop's `featureRegistry` rule). */
export function platformFlags(nodeEnv: string | undefined): readonly PlatformFlagDefinition[] {
  return PLATFORM_FLAGS.filter((flag) => flag.testOnly !== true || nodeEnv === "test")
}

/** Whether `key` is a platform flag under `nodeEnv`. */
export function isPlatformFlag(key: string, nodeEnv: string | undefined): boolean {
  return FEATURE_FLAG_KEY.test(key) && platformFlags(nodeEnv).some((flag) => flag.key === key)
}
