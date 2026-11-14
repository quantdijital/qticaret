/**
 * The `öne_çıkan_attribute` token (docs/13 §3): the value of the product's
 * first attribute marked "highlight in SEO" (adr/0013), as a shopper reads
 * it ("%100 keten", "20 cm", "Kırmızı, Mavi"). Pure, so tested on its own.
 */

interface Option {
  value?: unknown
  label?: unknown
}

export interface HighlightValue {
  value_text?: string | null
  value_number?: unknown
  value_boolean?: boolean | null
  value_options?: unknown
  definition?: {
    label?: string | null
    type?: string | null
    unit?: string | null
    rank?: number | null
    options?: unknown
    is_seo_highlight?: boolean | null
    is_public?: boolean | null
  } | null
}

const withUnit = (text: string, unit: string | null | undefined): string =>
  unit ? `${text} ${unit}` : text

function optionLabels(value: HighlightValue, chosen: readonly unknown[]): string {
  const options = Array.isArray(value.definition?.options)
    ? (value.definition.options as Option[])
    : []
  return chosen
    .map((each) => {
      const option = options.find((candidate) => candidate.value === each)
      const label = option?.label ?? each
      return typeof label === "string" ? label : ""
    })
    .filter(Boolean)
    .join(", ")
}

type Definition = NonNullable<HighlightValue["definition"]>

const FORMATS: Readonly<Record<string, (value: HighlightValue, definition: Definition) => string>> =
  {
    text: (value, definition) => withUnit((value.value_text ?? "").trim(), definition.unit),
    number: (value, definition) => {
      const number = Number(value.value_number)
      return Number.isFinite(number)
        ? withUnit(new Intl.NumberFormat("tr-TR").format(number), definition.unit)
        : ""
    },
    // "Bulaşık makinesinde yıkanabilir" says it; "hayır" says nothing worth a title
    boolean: (value, definition) => (value.value_boolean ? (definition.label ?? "") : ""),
    // A single choice sits in `value_text`, a multiple one in `value_options` (adr/0013)
    select: (value) => optionLabels(value, [value.value_text]),
    multi_select: (value) =>
      optionLabels(
        value,
        Array.isArray(value.value_options) ? (value.value_options as unknown[]) : []
      ),
  }

/** An attribute's value as a shopper reads it; empty when it has none. */
export function textOf(value: HighlightValue): string {
  const definition = value.definition
  const type = definition?.type ?? ""
  const format = Object.hasOwn(FORMATS, type) ? FORMATS[type] : undefined
  return definition && format ? format(value, definition) : ""
}

export function highlightText(values: readonly (HighlightValue | null)[]): string | null {
  const highlighted = values
    // A hidden attribute is never a highlight (T5); kept out should one be marked so
    .filter(
      (value): value is HighlightValue =>
        value?.definition?.is_seo_highlight === true && value.definition.is_public !== false
    )
    .sort((a, b) => (a.definition?.rank ?? 0) - (b.definition?.rank ?? 0))
  for (const value of highlighted) {
    const text = textOf(value)
    if (text) {
      return text
    }
  }
  return null
}
