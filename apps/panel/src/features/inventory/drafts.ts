/** A shelf count as typed: whole units, up to seven digits. */
export const DIGITS = /^\d{1,7}$/

/** Shelf counts typed but not saved yet, by item. */
export type Drafts = Record<string, string>

// The server's bound for a low-stock threshold, the shop's or an item's own
const MAX_THRESHOLD = 100_000

/** A low-stock threshold as typed: whole units, within the server's bound. */
export const isThreshold = (text: string): boolean =>
  /^\d{1,6}$/.test(text) && Number(text) <= MAX_THRESHOLD
