/**
 * Text the control plane keeps and shows again (names, notes, references):
 * no control or invisible format character, no line or paragraph
 * separator. One copy for the validators and the modules that check their
 * own input.
 */

/** One line: no control (`\p{Cc}`, so no newline) or format (`\p{Cf}`) character. */
export const CLEAN = /^[^\p{Cc}\p{Cf}\u2028\u2029]*$/u

/** A note of several lines: the same, but a newline is kept. */
export const CLEAN_TEXT = /^(?:[^\p{Cc}\p{Cf}\u2028\u2029]|\n)*$/u
