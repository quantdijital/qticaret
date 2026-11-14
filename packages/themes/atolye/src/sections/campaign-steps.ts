import type { BannerSettings, BannerStep } from "@qticaret/types"

/**
 * The band's steps as Atölye draws them (adr/0049 Ek 2026-11-14 §3.3 E2):
 * each a named class list, written whole so Tailwind finds it.
 */

/** A slide's proportion: a phone's, and from 640 px one slide's or two or three's. */
export const HEIGHT: Record<BannerStep<"height">, { phone: string; one: string; many: string }> = {
  low: { phone: "aspect-square", one: "sm:aspect-[3/1]", many: "sm:aspect-[16/9]" },
  medium: { phone: "aspect-[4/5]", one: "sm:aspect-[21/9]", many: "sm:aspect-[4/3]" },
  high: { phone: "aspect-[2/3]", one: "sm:aspect-[16/9]", many: "sm:aspect-square" },
}

type Row = "top" | "middle" | "bottom"
type Column = "left" | "center" | "right"

/** Where the words stand: the step's row and column. */
export function placeOf(position: BannerStep<"text_position">): { row: Row; column: Column } {
  const [row, column] = position.split("_") as [Row, Column]
  return { row, column }
}

export const ROW: Record<Row, string> = {
  top: "justify-start",
  middle: "justify-center",
  bottom: "justify-end",
}

/** On the right the words stay left-aligned (a ragged left edge reads badly). */
export const COLUMN: Record<Column, string> = {
  left: "items-start",
  center: "items-center text-center",
  right: "items-end",
}

/** The buttons: the shop's style for the first, one step quieter for the second. */
const BUTTON = {
  solid: ["gf-btn", "gf-btn gf-btn--quiet"],
  outline: ["gf-btn gf-btn--quiet", "gf-link"],
  text: ["gf-link", "gf-link"],
} as const satisfies Record<BannerStep<"button_style">, readonly [string, string]>

export const buttonClass = (style: BannerSettings["button_style"], second: boolean) =>
  BUTTON[style][second ? 1 : 0]

/**
 * The pictures' `sizes`: one fills the row (the container may be the
 * page's full width, a theme setting), two or three share it from 1024 px.
 */
export const sizesOf = (count: number): string =>
  count === 1 ? "100vw" : `(min-width: 1024px) ${count === 2 ? "50vw" : "34vw"}, 100vw`
