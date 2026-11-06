/** How a number field moves by its chevrons and arrow keys. */
export interface NumberStep {
  min: number
  max?: number | undefined
  step: number
  /** What an empty field counts as (its example's value) */
  start: number
}

/**
 * The value one step up or down: onto the next whole step (1.234 → 1.300
 * by 100, not 1.334), held between min and max; an empty or unreadable
 * field moves from `start`.
 */
export function nextValue(text: string, direction: 1 | -1, rule: NumberStep): number {
  const typed = text.trim() === "" ? Number.NaN : Number(text)
  const from = Number.isFinite(typed) ? typed : rule.start
  const next =
    direction > 0
      ? Math.floor(from / rule.step) * rule.step + rule.step
      : Math.ceil(from / rule.step) * rule.step - rule.step
  return Math.min(rule.max ?? Number.POSITIVE_INFINITY, Math.max(rule.min, next))
}

/**
 * A round step for a range of lira: about a twentieth of it, on 1, 2 or
 * 5 times a power of ten (100–4.000 TL moves by 200).
 */
export function roundStep(low: number, high: number): number {
  const raw = Math.max(1, (high - low) / 20)
  const power = 10 ** Math.floor(Math.log10(raw))
  const unit = raw / power
  return (unit < 1.5 ? 1 : unit < 3.5 ? 2 : unit < 7.5 ? 5 : 10) * power
}

/** The top of a range on a whole step (4.050 by 200 → 4.200). */
export const stepCeiling = (value: number, step: number): number => Math.ceil(value / step) * step
