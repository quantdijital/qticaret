import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const SOURCE = fileURLToPath(new URL("../../../../packages/themes/atolye/src/", import.meta.url))

/** One of the Atölye theme's stylesheets as written (`tokens.css`, `styles.css`, `ui.css`…). */
export const atolyeCss = (name: string): string => readFileSync(`${SOURCE}${name}`, "utf8")

/** The directory the theme's sources live in, with a trailing slash. */
export const ATOLYE_SOURCE = SOURCE

/** A custom property's value as the stylesheet first declares it; throws when it does not. */
export function declared(css: string, property: string): string {
  const found = new RegExp(`(?:^|[\\s;{])${property}:\\s*([^;]+);`).exec(css)
  if (!found?.[1]) {
    throw new Error(`${property} is not declared`)
  }
  return found[1].replace(/\s+/g, " ").trim()
}

/** A rule's body by its exact selector, the first one written. */
export function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) {
    throw new Error(`no rule for ${selector}`)
  }
  return css.slice(start, css.indexOf("}", start))
}
