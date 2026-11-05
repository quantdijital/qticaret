import type { AttributeInputValue } from "../../../modules/product-attributes/validation"
import type { MatchField } from "./match"

/**
 * A field's value as a report says it, in the server's Turkish: a number
 * with the field's unit (Turkish decimals), choices by their names, yes or
 * no, text as it is.
 */
export function valueText(field: Pick<MatchField, "unit" | "options">, value: AttributeInputValue) {
  if (value === null) {
    return ""
  }
  if (typeof value === "boolean") {
    return value ? "Evet" : "Hayır"
  }
  if (typeof value === "number") {
    const number = value.toLocaleString("tr-TR", { maximumFractionDigits: 6 })
    return field.unit ? `${number} ${field.unit}` : number
  }
  const name = (option: string) =>
    (field.options ?? []).find((each) => each.value === option)?.label ?? option
  return Array.isArray(value) ? value.map(name).join(", ") : field.options ? name(value) : value
}
