import { createContext, createElement, useContext } from "react"
import type { ReactNode } from "react"

/**
 * How a field's help text shows (docs/18 §7.1, the owner's "bilgi simgesi"):
 * as a line under it (`line`, every form's default) or folded into a
 * small (i) beside its name (`tip`, the theme editor's panels, so a long
 * column of settings reads as names and controls). Only the words that
 * say what a setting does fold away; an error, a count, a warning stays.
 */
export type FieldHintStyle = "line" | "tip"

const FieldHintsContext = createContext<FieldHintStyle>("line")

/** The help texts under this part of a page show as `style` says. */
export function FieldHints({ style, children }: { style: FieldHintStyle; children: ReactNode }) {
  return createElement(FieldHintsContext.Provider, { value: style }, children)
}

/** How the help texts here show: `line` unless a `FieldHints` says otherwise. */
export const useFieldHintStyle = (): FieldHintStyle => useContext(FieldHintsContext)
