import type { ElementStyle } from "./types.ts"

/**
 * Runs in the page (Playwright serialises it: it uses nothing from outside
 * its own body): every drawn element's resolved style, keyed by a
 * structural path that names no class and no React id, so moving a style
 * from one class or file to another keeps the key and the values.
 *
 * Key: from the nearest section (`data-qs`, numbered when repeated) or
 * `body`, one step per element: its tag, its stable attributes (an id that
 * is not generated, `role`, `aria-label`, `name`, `type`) and its place
 * among its siblings of the same tag, `[n]`. A pseudo-element with content
 * is its own entry, `…::before`.
 *
 * Inherited text properties (colour, font, line height, tracking, case)
 * are kept only where text is drawn (own text, a form control, an svg's
 * `currentColor`): elsewhere they show nowhere but in their children,
 * which carry their own.
 */
export function collectStyles(): Record<string, ElementStyle> {
  const SKIP = new Set([
    "SCRIPT",
    "STYLE",
    "LINK",
    "META",
    "NOSCRIPT",
    "TEMPLATE",
    "NEXTJS-PORTAL",
    "NEXT-ROUTE-ANNOUNCER",
  ])
  const TEXT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON", "svg"])
  const BOX = [
    "display",
    "background-color",
    "background-image",
    "border-radius",
    "box-shadow",
    "padding",
    "margin",
    "gap",
    "opacity",
  ]
  const TEXT = [
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "text-transform",
    "text-decoration-line",
  ]
  const DEFAULTS: Record<string, string> = {
    "background-color": "rgba(0, 0, 0, 0)",
    "background-image": "none",
    "border-radius": "0px",
    "box-shadow": "none",
    "letter-spacing": "normal",
    "text-transform": "none",
    "text-decoration-line": "none",
    padding: "0px",
    margin: "0px",
    gap: "normal",
    opacity: "1",
  }
  // useId (`«r1»`, `:r1:`), Radix (`radix-…`) and other generated ids say nothing stable
  const GENERATED_ID = /[«»:]|^radix-|^headlessui-|\d{3,}/

  const out: Record<string, ElementStyle> = {}
  const sections = new Map<string, number>()
  const tenths = (n: number) => Math.round(n * 10) / 10
  const cut = (s: string) => {
    const one = s.replace(/\s+/g, " ").trim()
    return one.length > 40 ? `${one.slice(0, 39)}…` : one
  }

  const step = (el: Element): string => {
    const tag = el.tagName.toLowerCase()
    let n = 1
    for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.tagName === el.tagName) {
        n += 1
      }
    }
    let marks = ""
    const id = el.getAttribute("id")
    if (id && !GENERATED_ID.test(id)) {
      marks += `#${id}`
    }
    for (const name of ["role", "name", "type"]) {
      const value = el.getAttribute(name)
      if (value) {
        marks += `[${name}=${value}]`
      }
    }
    const label = el.getAttribute("aria-label")
    if (label) {
      marks += `"${cut(label)}"`
    }
    return `${tag}${marks}[${n}]`
  }

  const resolveImage = (value: string) =>
    value === "none" ? value : value.replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, "url()")

  // A line that draws nothing (no style, or no width: Tailwind's reset gives
  // every element a solid 0 px border) is left out, its colour with it
  const line = (cs: CSSStyleDeclaration, name: string): string | null => {
    const style = cs.getPropertyValue(`${name}-style`)
    const width = cs.getPropertyValue(`${name}-width`)
    if (style === "none" || style === "hidden" || width === "0px") {
      return null
    }
    return `${width} ${style} ${cs.getPropertyValue(`${name}-color`)}`
  }

  const styleOf = (cs: CSSStyleDeclaration, text: boolean, w: number, h: number) => {
    const s: Record<string, string | number> = {}
    for (const prop of BOX) {
      let value = cs.getPropertyValue(prop)
      if (prop === "background-image") {
        value = resolveImage(value)
      }
      if (value !== DEFAULTS[prop]) {
        s[prop] = value
      }
    }
    for (const name of ["border-top", "border-right", "border-bottom", "border-left", "outline"]) {
      const value = line(cs, name)
      if (value !== null) {
        s[name] = value
      }
    }
    if (text) {
      for (const prop of TEXT) {
        const value = cs.getPropertyValue(prop)
        if (value !== DEFAULTS[prop]) {
          s[prop] = value
        }
      }
    }
    s["width"] = w
    s["height"] = h
    return s
  }

  const visit = (el: Element, path: string) => {
    if (SKIP.has(el.tagName)) {
      return
    }
    const cs = getComputedStyle(el)
    if (cs.display === "none") {
      return
    }
    const rect = el.getBoundingClientRect()
    const drawn = rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden"
    let ownText = ""
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        ownText += node.textContent ?? ""
      }
    }
    ownText = cut(ownText)
    if (drawn && cs.display !== "contents") {
      const text = ownText !== "" || TEXT_TAGS.has(el.tagName)
      const entry: ElementStyle = {
        s: styleOf(cs, text, tenths(rect.width), tenths(rect.height)),
      }
      const name =
        (ownText !== "" ? ownText : null) ??
        el.getAttribute("alt") ??
        el.getAttribute("aria-label") ??
        el.getAttribute("placeholder") ??
        // A small box (a card, a list item) reads by the text inside it
        (el.getElementsByTagName("*").length <= 40 ? el.textContent : null)
      if (name?.trim()) {
        entry.t = cut(name)
      }
      out[path] = entry
      for (const pseudo of ["::before", "::after"]) {
        const ps = getComputedStyle(el, pseudo)
        const content = ps.getPropertyValue("content")
        if (content && content !== "none" && content !== "normal" && ps.display !== "none") {
          const s = styleOf(ps, true, 0, 0)
          s["width"] = ps.getPropertyValue("width")
          s["height"] = ps.getPropertyValue("height")
          s["content"] = content
          out[`${path}${pseudo}`] = { s }
        }
      }
    }
    // An svg's insides (paths, groups) are its drawing, not the theme's boxes
    if (el.tagName.toLowerCase() === "svg") {
      return
    }
    for (const child of Array.from(el.children)) {
      const qs = child.getAttribute("data-qs")
      if (qs) {
        const seen = (sections.get(qs) ?? 0) + 1
        sections.set(qs, seen)
        visit(child, seen === 1 ? `[data-qs=${qs}]` : `[data-qs=${qs}](${seen})`)
      } else {
        visit(child, `${path} > ${step(child)}`)
      }
    }
  }

  visit(document.body, "body")
  return out
}
