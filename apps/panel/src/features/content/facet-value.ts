import type { LandingFacet } from "@/features/content/api/landings"

// One select value per facet: `kind|key|value` (keys and values hold no `|`)
export const encodeFacet = (facet: LandingFacet) => `${facet.kind}|${facet.key}|${facet.value}`

export function decodeFacet(value: string): LandingFacet | null {
  const [kind, key, option] = value.split("|")
  return (kind === "brand" || kind === "attribute") && key && option
    ? { kind, key, value: option }
    : null
}
