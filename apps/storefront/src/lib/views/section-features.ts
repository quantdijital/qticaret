import type { StorefrontAnswer } from "@qticaret/types"
import { SECTION_REQUIRES, requiredFlag, storefrontFlagOn } from "@qticaret/types/section-requires"

type Requires = Readonly<Record<string, string>>

/** Whether any of these sections needs a feature flag (no frame read otherwise). */
export const needsFlags = (
  sections: readonly { type: string }[],
  requires: Requires = SECTION_REQUIRES
): boolean => sections.some((section) => requiredFlag(section.type, requires) !== null)

/**
 * The sections the storefront may draw (adr/0077 §8): one whose feature
 * flag `GET /store/storefront`'s `features` does not say is on is left out.
 * The backend leaves them out already; this is the second check, for a
 * design held in a cache across a flag's change or an older backend.
 */
export function withFeatures<S extends { type: string }>(
  sections: readonly S[],
  features: StorefrontAnswer["features"],
  requires: Requires = SECTION_REQUIRES
): S[] {
  const isOn = storefrontFlagOn(features)
  return sections.filter((section) => {
    const flag = requiredFlag(section.type, requires)
    return flag === null || isOn(flag)
  })
}
