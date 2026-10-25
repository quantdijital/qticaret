/**
 * Feature flags (adr/0012). Code reads flags, never sector names; each phase
 * adds its own (`cash_on_delivery` F6, `seo_publish_gate` F3.13...). A flag
 * a tenant changes in the admin is `owner: "tenant"`; one that provisioning
 * sets (plans, F17) is `owner: "platform"` and read-only in the admin.
 */

export type FeatureOwner = "tenant" | "platform"

export interface FeatureDefinition {
  default: boolean
  owner: FeatureOwner
  /** i18n keys for the admin, under `qticaret.features.` (src/admin/i18n). */
  labelKey: string
  descriptionKey: string
}

export const FEATURES: Readonly<Record<string, FeatureDefinition>> = Object.freeze({})

/**
 * Flags for tests only, present under NODE_ENV=test (like RATE_LIMIT_RELAXED):
 * the platform has no business flag yet, and the gate must be proven.
 */
const TEST_FEATURES: Readonly<Record<string, FeatureDefinition>> = Object.freeze({
  "test.sample": {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.test_sample.label",
    descriptionKey: "qticaret.features.test_sample.description",
  },
  "test.platform_sample": {
    default: true,
    owner: "platform",
    labelKey: "qticaret.features.test_platform_sample.label",
    descriptionKey: "qticaret.features.test_platform_sample.description",
  },
})

export function featureRegistry(
  env: NodeJS.ProcessEnv = process.env
): Readonly<Record<string, FeatureDefinition>> {
  return env["NODE_ENV"] === "test" ? { ...FEATURES, ...TEST_FEATURES } : FEATURES
}

/** The flag's definition, or undefined; own keys only (`__proto__` is not a flag). */
export function featureDefinition(
  key: string,
  env: NodeJS.ProcessEnv = process.env
): FeatureDefinition | undefined {
  const registry = featureRegistry(env)
  return Object.hasOwn(registry, key) ? registry[key] : undefined
}
