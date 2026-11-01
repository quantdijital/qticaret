import type { KeepStateOptions } from "react-hook-form"

/**
 * For a form's own `reset`: undo, or what the server stored after a save.
 * RHF merges the form's `resetOptions` into every `reset` call, and the
 * `keepDirtyValues` our cards set there (so a background refetch does not
 * wipe what is being typed) would keep every field once edited as it was
 * typed. Passed explicitly, this puts the given values back in every field.
 */
export const FULL_RESET = { keepDirtyValues: false } as const satisfies KeepStateOptions
