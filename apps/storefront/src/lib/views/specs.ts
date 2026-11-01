import type { StoreAttributeValue } from "@qticaret/types"
import type { SpecView, Translate } from "@qticaret/ui"

const NUMBER = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 })

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
    case "multi_select": {
      const labels = (attribute.value_options ?? []).map(
        (value) => definition.options?.find((option) => option.value === value)?.label ?? value
      )
      return labels.length > 0 ? labels.join(", ") : null
    }
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
              label: attribute.definition.label,
              value,
              highlight: attribute.definition.is_seo_highlight,
            },
          ]
        : []
    })
}
