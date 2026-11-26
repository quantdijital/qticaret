import type { FieldValues, KeepStateOptions, Path, PathValue, UseFormReturn } from "react-hook-form"

/**
 * For a form's own `reset`: undo, or what the server stored after a save.
 * RHF merges the form's `resetOptions` into every `reset` call, and the
 * `keepDirtyValues` our cards set there (so a background refetch does not
 * wipe what is being typed) would keep every field once edited as it was
 * typed. Passed explicitly, this puts the given values back in every field.
 */
export const FULL_RESET = { keepDirtyValues: false } as const satisfies KeepStateOptions

// Plain data only: arrays and plain objects are walked, anything else (a File, a Date) is kept by reference
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

const copyOf = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(copyOf)
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyOf(item)]))
  }
  return value
}

const sameValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((item, index) => sameValue(item, right[index]))
    )
  }
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime()
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    return [...keys].every((key) => sameValue(left[key], right[key]))
  }
  return false
}

type SavingForm<T extends FieldValues> = Pick<UseFormReturn<T>, "getValues" | "reset" | "setValue">

/**
 * A save that does not swallow what is typed while it is on its way. Call
 * it as the save starts (the first line of the `handleSubmit` callback): it
 * notes what the form holds then. The function it returns replaces the
 * `form.reset(saved, FULL_RESET)` after the server answered: the saved
 * values become the form's baseline, and every field changed since the save
 * started keeps its new value, so the form ends clean when nothing was
 * touched meanwhile and dirty ("Kaydet" active again) when something was.
 * Compared per top-level field: a list edited meanwhile is kept whole.
 */
export function beginSave<T extends FieldValues>(form: SavingForm<T>): (saved: T) => void {
  const sent = copyOf(form.getValues()) as Record<string, unknown>
  return (saved) => {
    const now = copyOf(form.getValues()) as Record<string, unknown>
    const keys = new Set([...Object.keys(sent), ...Object.keys(now)])
    const edited = [...keys].filter((key) => !sameValue(sent[key], now[key]))
    form.reset(saved, FULL_RESET)
    for (const key of edited) {
      const name = key as Path<T>
      form.setValue(name, now[key] as PathValue<T, Path<T>>, { shouldDirty: true })
    }
  }
}
