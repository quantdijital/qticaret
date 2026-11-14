import type { StoreAttributeValue } from "@qticaret/types"
import type { SpecGroupView, SpecView, Translate } from "@qticaret/ui"

const NUMBER = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 })

/** The chosen options by their labels; one the definition no longer lists by its stored value. */
function labelsOf(
  definition: StoreAttributeValue["definition"],
  chosen: readonly (string | null)[]
): string | null {
  const labels = chosen.flatMap((value) => {
    const stored = value?.trim() ?? ""
    if (stored === "") {
      return []
    }
    return [definition.options?.find((option) => option.value === value)?.label ?? stored]
  })
  return labels.length > 0 ? labels.join(", ") : null
}

function valueOf(attribute: StoreAttributeValue, t: Translate): string | null {
  const { definition } = attribute
  switch (definition.type) {
    case "text": {
      // A text of only spaces is no value
      const text = attribute.value_text?.trim() ?? ""
      return text === "" ? null : text
    }
    case "number": {
      const number = Number(attribute.value_number)
      if (attribute.value_number === null || !Number.isFinite(number)) {
        return null
      }
      return definition.unit ? `${NUMBER.format(number)} ${definition.unit}` : NUMBER.format(number)
    }
    case "boolean":
      return attribute.value_boolean === null
        ? null
        : t(attribute.value_boolean ? "spec.yes" : "spec.no")
    case "select":
      // A single choice sits in `value_text`, a multiple one in `value_options` (adr/0013)
      return labelsOf(definition, [attribute.value_text])
    case "multi_select":
      return labelsOf(definition, attribute.value_options ?? [])
  }
}

/**
 * A product's public attributes as a shopper reads them (adr/0013), in the
 * shop's order: numbers in Turkish with their unit, yes/no in words,
 * options by their labels. An attribute without a value is left out.
 */
export function specsOf(
  attributes: readonly StoreAttributeValue[] | null | undefined,
  t: Translate
): SpecView[] {
  return shownSpecs(attributes, t).map(({ spec }) => spec)
}

/** The attributes with a value, in the shop's order, each with its section's key. */
function shownSpecs(
  attributes: readonly StoreAttributeValue[] | null | undefined,
  t: Translate
): { spec: SpecView; group: string | null }[] {
  return [...(attributes ?? [])]
    .sort(
      (a, b) =>
        a.definition.rank - b.definition.rank ||
        a.definition.label.localeCompare(b.definition.label, "tr")
    )
    .flatMap((attribute) => {
      const value = valueOf(attribute, t)
      return value
        ? [
            {
              spec: {
                label: attribute.definition.label,
                value,
                highlight: attribute.definition.is_seo_highlight,
              },
              group: attribute.definition.group ?? null,
            },
          ]
        : []
    })
}

/**
 * The same attributes in their template's sections (adr/0013 Ek
 * 2026-11-04), in the sections' order; those in no section last, under no
 * title. A template without sections gives one untitled group: the plain
 * table. An empty section is left out.
 */
export function specGroupsOf(
  attributes: readonly StoreAttributeValue[] | null | undefined,
  t: Translate
): SpecGroupView[] {
  const shown = shownSpecs(attributes, t)
  if (shown.length === 0) {
    return []
  }
  const sections = [
    ...((attributes ?? []).find((each) => each.definition.template?.groups)?.definition.template
      ?.groups ?? []),
  ].sort((a, b) => a.rank - b.rank)
  const known = new Set(sections.map((section) => section.key))
  const groups: SpecGroupView[] = sections.map((section) => ({
    title: section.name,
    rows: shown.filter((each) => each.group === section.key).map(({ spec }) => spec),
  }))
  const loose = shown.filter((each) => !each.group || !known.has(each.group))
  return [...groups, { title: null, rows: loose.map(({ spec }) => spec) }].filter(
    (group) => group.rows.length > 0
  )
}
