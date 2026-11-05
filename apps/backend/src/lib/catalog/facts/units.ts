import { UNIT_DIMENSIONS } from "./vocabulary"

/**
 * Units as descriptions write them (adr/0013 Ek 2026-11-05): a unit is
 * known by any of its names in the vocabulary; a number moves between two
 * units of one dimension (22 cm → 220 mm). Any other unit is compared as
 * written, case and dots off ("HRC" is "hrc", "°" is "°").
 */

interface KnownUnit {
  dimension: string
  /** Its size in the dimension's base unit. */
  size: number
  /** How it is written back: the vocabulary's own key. */
  name: string
}

/** A unit written for comparison: lower case, Turkish letters folded, dots and spaces off. */
export const unitKey = (unit: string): string =>
  unit
    .normalize("NFC")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\s.]+/g, "")

const KNOWN: ReadonlyMap<string, KnownUnit> = new Map(
  Object.entries(UNIT_DIMENSIONS).flatMap(([dimension, units]) =>
    Object.entries(units).flatMap(([name, unit]) =>
      unit.names.map((each) => [unitKey(each), { dimension, size: unit.size, name }] as const)
    )
  )
)

export const knownUnit = (unit: string): KnownUnit | undefined => KNOWN.get(unitKey(unit))

/** Whether text is a unit a label can name in brackets: "Boy (cm)". */
export const isUnitWord = (text: string): boolean =>
  knownUnit(text) !== undefined || /^[\p{L}°%"″]{1,5}$/u.test(text.trim())

// Six places keep a converted value honest (22 cm in inches) without float noise
const round = (value: number): number => Math.round(value * 1e6) / 1e6

/**
 * `value` written in `from`, in `to`: the same when the two are one unit
 * (or `from` is none: the field's unit is assumed), converted within a
 * dimension, otherwise none.
 */
export function convert(value: number, from: string | null, to: string | null): number | null {
  if (!from || !to || unitKey(from) === unitKey(to)) {
    return value
  }
  const source = knownUnit(from)
  const target = knownUnit(to)
  if (!source || !target) {
    return null
  }
  if (source.dimension !== target.dimension) {
    return null
  }
  return round((value * source.size) / target.size)
}

/** Whether two units are the same or convert into each other. */
export const compatible = (a: string | null, b: string | null): boolean => convert(1, a, b) !== null

/** A unit as a new field takes it: the vocabulary's name for a known one, else as written. */
export const unitName = (unit: string): string => knownUnit(unit)?.name ?? unit.trim()
