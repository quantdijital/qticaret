import type { TFunction } from "i18next"
import type { AttributeDefinition, AttributeValue } from "@/features/attributes/types"

/** A field's value as the preview shows it: a number with its unit, choices by name, yes or no. */
export function factValueText(
  t: TFunction,
  definition: Pick<AttributeDefinition, "unit" | "options"> | undefined,
  value: AttributeValue | undefined
): string {
  if (value === null || value === undefined) {
    return ""
  }
  if (typeof value === "boolean") {
    return t(value ? "attributes.facts.yes" : "attributes.facts.no")
  }
  if (typeof value === "number") {
    const number = value.toLocaleString("tr-TR", { maximumFractionDigits: 6 })
    return definition?.unit ? `${number} ${definition.unit}` : number
  }
  const name = (option: string) =>
    definition?.options?.find((each) => each.value === option)?.label ?? option
  return Array.isArray(value) ? value.map(name).join(", ") : name(value)
}
