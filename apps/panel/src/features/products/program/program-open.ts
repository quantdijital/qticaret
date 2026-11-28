/**
 * Which steps of the program editor are unfolded, by their place in the
 * list: a step folds to one line by default, and stays open or closed as
 * it moves or as a step before it is taken out.
 */
export type OpenSteps = ReadonlySet<number>

/** The step at `at` opened or closed. */
export function toggledOpen(open: OpenSteps, at: number): OpenSteps {
  const next = new Set(open)
  if (next.has(at)) {
    next.delete(at)
  } else {
    next.add(at)
  }
  return next
}

/** The open steps after the one at `from` moves to `to` (the others shift by one). */
export function movedOpen(open: OpenSteps, count: number, from: number, to: number): OpenSteps {
  const flags = Array.from({ length: count }, (_, index) => open.has(index))
  const [moved] = flags.splice(from, 1)
  flags.splice(to, 0, moved ?? false)
  return new Set(flags.flatMap((flag, index) => (flag ? [index] : [])))
}

/** The open steps after the one at `at` is taken out (those after it move up one). */
export function removedOpen(open: OpenSteps, at: number): OpenSteps {
  return new Set(
    [...open].flatMap((index) => (index === at ? [] : [index > at ? index - 1 : index]))
  )
}

/** Every step open, or (all of them open already) none. */
export function allToggled(open: OpenSteps, count: number): OpenSteps {
  const allOpen = count > 0 && Array.from({ length: count }).every((_, index) => open.has(index))
  return allOpen ? new Set() : new Set(Array.from({ length: count }, (_, index) => index))
}
