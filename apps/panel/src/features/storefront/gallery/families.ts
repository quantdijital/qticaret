import type { PresetCard, PresetRef } from "./api"

/**
 * The ready-made looks as the gallery shows them: one card per colour
 * family (Shopify's theme styles), its members the colour sets to pick
 * from. A look with no family is a family of its own.
 */
export interface PresetFamily {
  /** `pack/family`: unique across packs. */
  key: string
  /** The family's name: its own look's, else the members' up to "·". */
  name: string
  /** Its own look first (the code that names the family), then the rest as listed. */
  members: PresetCard[]
}

const base = (name: string) => {
  const head = name.split("·")[0]?.trim() ?? ""
  return head === "" ? name : head
}

export function presetFamilies(presets: readonly PresetCard[]): PresetFamily[] {
  const families = new Map<string, PresetCard[]>()
  for (const preset of presets) {
    const key = `${preset.pack}/${preset.family}`
    families.set(key, [...(families.get(key) ?? []), preset])
  }
  return [...families].map(([key, members]) => {
    const own = members.find((each) => each.code === each.family)
    const ordered = own ? [own, ...members.filter((each) => each !== own)] : members
    const first = ordered[0]
    return { key, name: own ? own.name : base(first?.name ?? ""), members: ordered }
  })
}

/** The same look, at any version. */
export const isLook = (preset: PresetRef, ref: PresetRef | null) =>
  ref !== null && ref.pack === preset.pack && ref.code === preset.code

/** The member shown first: the one in the draft, else the live one, else the family's own. */
export function shownMember(family: PresetFamily): PresetCard | undefined {
  return (
    family.members.find((each) => each.in_draft !== null) ??
    family.members.find((each) => each.live !== null) ??
    family.members[0]
  )
}

/** A newer version of the look than the one the draft or the live design has. */
export const hasNewVersion = (preset: PresetCard) =>
  [preset.in_draft, preset.live].some((version) => version !== null && version < preset.version)
