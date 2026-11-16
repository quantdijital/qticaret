/**
 * A theme token's value at a screen width, as a browser resolves it from
 * the stylesheet as written (`tokens.css`, `density.css`): the rules for
 * the element's own selector first (`[data-density="balanced"]` on the
 * theme's root), then what it inherits from `:root`; within each, the last
 * rule whose media query holds. Enough for the theme's flat token blocks:
 * `sel { … }` and `@media (…) { sel { … } }`, the width conditions the
 * theme writes (`width < 64rem`, `max-width: 40rem`…), at 16 px a rem.
 */

interface Rule {
  media: string | null
  selector: string
  body: string
}

const REM = 16

/** The stylesheet's rules, comments out, each with the media query around it. */
function rulesOf(css: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const rules: Rule[] = []
  const walk = (from: number, to: number, media: string | null) => {
    let at = from
    while (at < to) {
      const open = text.indexOf("{", at)
      if (open < 0 || open >= to) {
        return
      }
      const head = text.slice(at, open).trim()
      let depth = 1
      let close = open + 1
      while (depth > 0 && close < to) {
        if (text[close] === "{") depth += 1
        if (text[close] === "}") depth -= 1
        close += 1
      }
      if (head.startsWith("@media")) {
        walk(open + 1, close - 1, head.slice("@media".length).trim())
      } else if (head.startsWith("@")) {
        walk(open + 1, close - 1, media)
      } else {
        for (const selector of head.split(",")) {
          rules.push({ media, selector: selector.trim(), body: text.slice(open + 1, close - 1) })
        }
      }
      at = close
    }
  }
  walk(0, text.length, null)
  return rules
}

/** Whether a media query of the theme's holds at `width` px. */
export function mediaHolds(media: string | null, width: number): boolean {
  if (media === null) {
    return true
  }
  return [...media.matchAll(/\(([^)]+)\)/g)].every(([, condition = ""]) => {
    const found = /^(width\s*(<|>=|<=|>)|max-width:|min-width:)\s*([\d.]+)rem$/.exec(
      condition.trim()
    )
    if (!found) {
      throw new Error(`unknown media condition: ${condition}`)
    }
    const edge = Number(found[3]) * REM
    const operator = found[2] ?? found[1]
    if (operator === "<") {
      return width < edge
    }
    if (operator === ">=" || operator === "min-width:") {
      return width >= edge
    }
    if (operator === "<=" || operator === "max-width:") {
      return width <= edge
    }
    return width > edge
  })
}

const valueIn = (body: string, token: string): string | null => {
  const found = new RegExp(`(?:^|[\\s;])${token}:\\s*([^;]+);`).exec(body)
  return found?.[1]?.trim() ?? null
}

/** A length as px: `24px`, `1.5rem`; anything else throws. */
export function px(value: string): number {
  const found = /^(-?[\d.]+)(px|rem)$/.exec(value)
  if (!found) {
    throw new Error(`not a plain length: ${value}`)
  }
  return Number(found[1]) * (found[2] === "rem" ? REM : 1)
}

/**
 * The token's value at `width` px on an element matched by `own` (the
 * theme root's density mark), inheriting from `:root` when no rule there
 * sets it. `sheets` in source order (later wins on a tie).
 */
export function tokenAt(
  sheets: readonly string[],
  token: string,
  width: number,
  own: string | null = null
): string {
  const rules = sheets.flatMap(rulesOf)
  for (const selector of own === null ? [":root"] : [own, ":root"]) {
    const value = rules
      .filter((rule) => rule.selector === selector && mediaHolds(rule.media, width))
      .map((rule) => valueIn(rule.body, token))
      .filter((found) => found !== null)
      .at(-1)
    if (value !== undefined) {
      return value
    }
  }
  throw new Error(`${token} is not declared for ${own ?? ":root"} at ${width}px`)
}

/** Tailwind's breakpoints the theme's classes use, in px (16 px a rem). */
const BREAKPOINTS: Readonly<Record<string, number>> = { sm: 640, md: 768, lg: 1024, xl: 1280 }

/**
 * What a list of Tailwind spacing classes gives one property at `width`
 * px: `gap-6 lg:gap-10` is 24 below 1024 px, 40 from it (4 px a step,
 * Tailwind's `--spacing`); null when no class sets it.
 */
export function utilityAt(classes: string, prefix: string, width: number): number | null {
  let found: number | null = null
  let from = -1
  for (const name of classes.split(/\s+/)) {
    const colon = name.indexOf(":")
    const utility = name.slice(colon + 1)
    const step = new RegExp(`^${prefix}-([\\d.]+)$`).exec(utility)
    const edge = colon < 0 ? 0 : (BREAKPOINTS[name.slice(0, colon)] ?? Infinity)
    if (step && width >= edge && edge >= from) {
      found = Number(step[1]) * 4
      from = edge
    }
  }
  return found
}
