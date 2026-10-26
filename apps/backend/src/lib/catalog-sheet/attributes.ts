import type {
  AttributeInputValue,
  DefinitionShape,
} from "../../modules/product-attributes/validation"
import { toSlug } from "../seo/slug"
import { decimalCell, textCell } from "./cells"
import type { Cell } from "./cells"

/**
 * An attribute cell as its definition takes it (adr/0013): a choice by its
 * value or its name (`paslanmaz_celik` or `Paslanmaz Çelik`), several
 * separated by `|`; a yes/no as `Evet`/`Hayır`; a number as the sheet
 * writes numbers. The template's own checks run again when it is saved.
 */

const BOOLEANS: Readonly<Record<string, boolean>> = {
  evet: true,
  var: true,
  true: true,
  "1": true,
  hayir: false,
  yok: false,
  false: false,
  "0": false,
}

const MAX_ATTRIBUTE_TEXT = 500

function optionOf(definition: DefinitionShape, raw: string): string | null {
  const wanted = toSlug(raw)
  const option = (definition.options ?? []).find(
    (each) =>
      each.value === raw.trim() || toSlug(each.label) === wanted || toSlug(each.value) === wanted
  )
  return option?.value ?? null
}

export function attributeValueOf(
  definition: DefinitionShape,
  raw: string
): Cell<AttributeInputValue> {
  const fail = { ok: false as const, key: "catalog_import.attribute_invalid" }
  switch (definition.type) {
    case "text":
      return textCell(raw, MAX_ATTRIBUTE_TEXT)
    case "number":
      return decimalCell(raw, { max: 1e12, decimals: 6, key: fail.key, signed: true })
    case "boolean": {
      const value = BOOLEANS[toSlug(raw) || raw.trim()]
      return value === undefined ? fail : { ok: true, value }
    }
    case "select": {
      const value = optionOf(definition, raw)
      return value === null ? fail : { ok: true, value }
    }
    case "multi_select": {
      const values = raw
        .split("|")
        .map((each) => each.trim())
        .filter((each) => each !== "")
        .map((each) => optionOf(definition, each))
      return values.length === 0 || values.includes(null)
        ? fail
        : { ok: true, value: [...new Set(values as string[])] }
    }
  }
}
