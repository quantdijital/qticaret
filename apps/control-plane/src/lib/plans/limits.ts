import { LIMIT_KEYS, isGrantLimit } from "@qticaret/types/control-plane"
import type { LimitKey } from "@qticaret/types/control-plane"

/** A limit's value: a count or megabytes, null for no limit (a grant is never null). */
export type LimitValue = number | null

/** What a key is without a value: no limit, but a grant (adr/0085 K5) gives nothing. */
export const limitDefault = (key: LimitKey): LimitValue => (isGrantLimit(key) ? 0 : null)

export type LimitValues = Record<LimitKey, LimitValue>

export interface OverrideLike {
  key: LimitKey
  value: LimitValue
  expires_at: Date | string | null
}

export interface EffectiveLimit {
  key: LimitKey
  /** The package's value; undefined when the shop has no package. */
  package: LimitValue | undefined
  /** The shop's own value while its exception holds; undefined when none does. */
  override: LimitValue | undefined
  /** What applies: the exception's, else the package's, else none (no package: no limit yet). */
  value: LimitValue
}

/** Every registry key with the value given, its default (`limitDefault`) for the ones not given. */
export function fullLimits(given: Partial<Record<string, LimitValue>>): LimitValues {
  return Object.fromEntries(
    LIMIT_KEYS.map((key) => [key, given[key] ?? limitDefault(key)])
  ) as LimitValues
}

export const overrideHolds = (override: OverrideLike, now: Date): boolean =>
  override.expires_at === null || new Date(override.expires_at).getTime() > now.getTime()

/**
 * What a shop may use, key by key (adr/0061 §2): its exception while it
 * holds, else its package's value. A shop without a package has no limit
 * (the shop's unmanaged mode, §3.3, says the same) and no grant.
 */
export function effectiveLimits(
  packageLimits: LimitValues | null,
  overrides: readonly OverrideLike[],
  now: Date = new Date()
): EffectiveLimit[] {
  return LIMIT_KEYS.map((key) => {
    const own = overrides.find((each) => each.key === key && overrideHolds(each, now))
    const fromPackage = packageLimits ? packageLimits[key] : undefined
    return {
      key,
      package: fromPackage,
      override: own ? own.value : undefined,
      value: own ? own.value : (fromPackage ?? limitDefault(key)),
    }
  })
}
