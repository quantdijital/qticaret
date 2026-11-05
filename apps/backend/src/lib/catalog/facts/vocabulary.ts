/**
 * The words the description facts reader goes by (adr/0013 Ek
 * 2026-11-05): data, not code, and no sector's. Each list is compared as
 * `labelKey` reads it (Turkish letters folded, case and punctuation off),
 * so "TEKNİK ÖZELLİKLER:" and "Teknik özellikler" are one entry. A shop
 * whose descriptions use another heading is served by adding it here.
 */

/** Headings that open a section of facts: its "Label: value" lines are read. */
export const SPEC_HEADINGS: readonly string[] = [
  "Özellikler",
  "Teknik Özellikler",
  "Ürün Özellikleri",
  "Teknik Bilgiler",
  "Teknik Detaylar",
  "Ürün Bilgileri",
  "Ürün Detayları",
  "Ürün Bilgisi",
  "Teknik Veriler",
  "Genel Özellikler",
  "Specifications",
  "Technical Specifications",
  "Specs",
  "Product Details",
  "Product Specifications",
  "Features",
]

/** A table's first row that only names its columns ("Özellik | Değer"), not a fact. */
export const TABLE_HEADER_WORDS: readonly string[] = [
  "Özellik",
  "Özellikler",
  "Değer",
  "Değerler",
  "Açıklama",
  "Bilgi",
  "Property",
  "Value",
  "Feature",
  "Specification",
  "Attribute",
]

/** Labels of a remark, not a fact ("Not: …"): never offered as a field. */
export const REMARK_LABELS: readonly string[] = [
  "Not",
  "Notlar",
  "Uyarı",
  "Önemli",
  "Dikkat",
  "Bilgi",
  "Bilgilendirme",
  "Açıklama",
  "Note",
  "Warning",
  "Important",
]

/** Yes and no as descriptions write them. */
export const BOOLEAN_WORDS: Readonly<Record<string, boolean>> = {
  evet: true,
  var: true,
  mevcut: true,
  yes: true,
  true: true,
  hayir: false,
  yok: false,
  no: false,
  false: false,
}

/**
 * Units by what they measure, each with its size in the dimension's base
 * unit (millimetre, gram, millilitre, second), and the ways descriptions
 * write them. A number is converted only within one dimension; any other
 * unit (a hardness scale, a percent) must be written as the field's.
 */
export const UNIT_DIMENSIONS: Readonly<
  Record<string, Readonly<Record<string, { size: number; names: readonly string[] }>>>
> = {
  length: {
    mm: { size: 1, names: ["mm", "milimetre", "millimeter", "millimetre"] },
    cm: { size: 10, names: ["cm", "santimetre", "santim", "centimeter", "centimetre"] },
    m: { size: 1000, names: ["m", "metre", "meter", "mt"] },
    inch: { size: 25.4, names: ["inch", "inc", "in", "inches", '"', "″"] },
  },
  mass: {
    mg: { size: 0.001, names: ["mg", "miligram", "milligram"] },
    g: { size: 1, names: ["g", "gr", "gram", "grams"] },
    kg: { size: 1000, names: ["kg", "kilogram", "kilo"] },
    lb: { size: 453.59237, names: ["lb", "lbs", "pound"] },
    oz: { size: 28.349523125, names: ["oz", "ons", "ounce"] },
  },
  volume: {
    ml: { size: 1, names: ["ml", "mililitre", "milliliter", "millilitre"] },
    cl: { size: 10, names: ["cl", "santilitre"] },
    l: { size: 1000, names: ["l", "lt", "litre", "liter"] },
  },
  time: {
    s: { size: 1, names: ["sn", "s", "saniye", "sec", "second"] },
    min: { size: 60, names: ["dk", "dakika", "min", "minute"] },
    h: { size: 3600, names: ["sa", "saat", "h", "hour", "hours"] },
  },
}
