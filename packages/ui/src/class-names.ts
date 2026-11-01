/** Joins the truthy class names: `cx("a", on && "b")`. */
export const cx = (...names: (string | false | null | undefined)[]): string =>
  names.filter(Boolean).join(" ")
