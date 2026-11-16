import createDOMPurify from "dompurify"
import type {
  Config,
  UponSanitizeAttributeHookEvent,
  UponSanitizeElementHookEvent,
} from "dompurify"
// jsdom 26: the last line without an ES module dependency, which Jest's CommonJS runtime
// (the unit tests) cannot load; it parses only, no script ever runs in it
import { JSDOM } from "jsdom"
import { ValidationError, isValidationError } from "../errors"
import { cleanDeclarations, cleanStyleSheet, valueReachesOut } from "./svg-css"

/**
 * SVG for the shop's logos and site icon (the owner, 2026-11-16: "logoyu
 * svg olarak eklemek istiyorum"). An SVG is a document that can carry
 * script, so it is stored only as cleaned here, never as sent: parsed and
 * cleaned by DOMPurify (its SVG profile) over jsdom, then held to an
 * allow list. Gone: scripts, `foreignObject`, frames and embeds, `<use>`
 * (outside DOMPurify's SVG profile for its past bypasses), every
 * animation (one can rewrite an `href`), every `on*` handler, raster
 * images, every reference out of the document (`href` keeps `#id` only),
 * every attribute value with an escape, an at-rule, an image function or
 * a `url()` to anything but an `#id`, and the DOCTYPE with its entities
 * (the HTML parser expands none: no XXE, no "billion laughs"). CSS (a
 * `<style>` sheet, a `style` attribute) is rebuilt from an allow list
 * (`svg-css.ts`). The size, element and depth limits are measured before
 * DOMPurify reads it. What is left must be one `<svg>`; it is
 * written out again as XML, with a width and height from its `viewBox`
 * when it named none (pages reserve its box: no layout shift).
 */

/** The largest SVG taken at all (a logo); the site icon's own limit is lower. */
export const SVG_MAX_BYTES = 200 * 1024
export const SVG_MAX_ELEMENTS = 5_000
export const SVG_MAX_DEPTH = 64
/** The box of an SVG that names no size of any kind. */
export const SVG_DEFAULT_SIDE = 512
const SVG_MAX_SIDE = 10_000
const SVG_NS = "http://www.w3.org/2000/svg"

export const SVG_MIME = "image/svg+xml"

// Elements that run, embed, fetch or change the document over time
const FORBIDDEN = [
  "script",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "image",
  "feImage",
  "animate",
  "animateMotion",
  "animateTransform",
  "animateColor",
  "set",
  "discard",
  "a",
]
// DOMPurify reads tag names lower-cased from the HTML parser; both spellings, to be sure
const FORBID_TAGS = [...new Set([...FORBIDDEN, ...FORBIDDEN.map((tag) => tag.toLowerCase())])]
// Taken with everything inside them (a link's shapes stay: it is only unwrapped)
const FORBID_CONTENTS = FORBID_TAGS.filter((tag) => tag !== "a")

const LINKS = new Set(["href", "xlink:href"])

/** A detection, not a cleaner: does the file start as an SVG document? */
export function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, 4096))
    .toString("utf8")
    .replace(/^\uFEFF/, "")
  return /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype[^>[]*(\[[\s\S]*?\])?\s*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(
    head
  )
}

const refuse = (code: string): never => {
  throw new ValidationError(code, { field: "files" })
}

function decode(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "")
  } catch {
    return refuse("upload.svg_invalid")
  }
}

const number = (value: string | null): number | null => {
  if (value === null || !/^\s*\d+(\.\d+)?\s*(px)?\s*$/.test(value)) {
    return null
  }
  const parsed = Number.parseFloat(value)
  return parsed > 0 ? parsed : null
}

/** Width and height: the attributes when they are plain numbers, else the `viewBox`'s. */
function boxOf(svg: Element): { width: number; height: number } {
  const view = (svg.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  const fromView =
    view.length === 4 && view.every(Number.isFinite) && (view[2] ?? 0) > 0 && (view[3] ?? 0) > 0
      ? { width: view[2] ?? 0, height: view[3] ?? 0 }
      : null
  const width = number(svg.getAttribute("width")) ?? fromView?.width ?? SVG_DEFAULT_SIDE
  const height = number(svg.getAttribute("height")) ?? fromView?.height ?? SVG_DEFAULT_SIDE
  const clamp = (side: number) => Math.min(SVG_MAX_SIDE, Math.max(1, Math.round(side)))
  return { width: clamp(width), height: clamp(height) }
}

/**
 * Elements and depth, counted on the parsed document with a stack (no
 * recursion): one past the limits is refused before DOMPurify reads it,
 * whose "keep the content, drop the element" path copies a deep tree over
 * and over (`"<a>".repeat(4000)` would hold the event loop).
 */
function checkShape(root: Element): void {
  const stack: [Element, number][] = [[root, 0]]
  let count = 0
  for (let next = stack.pop(); next; next = stack.pop()) {
    const [node, depth] = next
    if (depth > SVG_MAX_DEPTH || ++count > SVG_MAX_ELEMENTS) {
      refuse("upload.svg_too_complex")
    }
    for (const child of Array.from(node.children)) {
      stack.push([child, depth + 1])
    }
  }
}

const TAG = /<(\/?)([a-zA-Z][^\s/>]*)[^>]*?(\/?)>/g

/**
 * A linear look at the text before anything is parsed: start tags (one
 * element at least each) and how deep they nest as written. A parser
 * building a 4,000-deep tree spends seconds; this spends microseconds.
 * It reads tags only, so it may count a file deeper than its tree (an
 * unclosed tag): such a file is refused, which a design program's never is.
 */
function prescan(text: string): void {
  const tags = text.replace(/<!--[\s\S]*?(-->|$)/g, "")
  let depth = 0
  let count = 0
  for (const [, closing, , selfClosing] of tags.matchAll(TAG)) {
    if (closing) {
      depth = Math.max(0, depth - 1)
      continue
    }
    if (++count > SVG_MAX_ELEMENTS || (!selfClosing && ++depth > SVG_MAX_DEPTH)) {
      refuse("upload.svg_too_complex")
    }
  }
}

/** Measures before cleaning: the text, then the parsed tree; the counts and depth, or a refusal. */
function measure(window: JSDOM["window"], text: string): void {
  prescan(text)
  try {
    const parsed = new window.DOMParser().parseFromString(text, "text/html")
    checkShape(parsed.body)
  } catch (error) {
    if (isValidationError(error)) {
      throw error
    }
    // A parser out of stack on a deep tree: too complex, not our failure
    refuse("upload.svg_too_complex")
  }
}

export interface CleanSvg {
  buffer: Buffer
  width: number
  height: number
}

function addHooks(purify: ReturnType<typeof createDOMPurify>): void {
  purify.addHook("uponSanitizeElement", (node, data: UponSanitizeElementHookEvent) => {
    // A style sheet keeps only the rules its allow list reads in full (svg-css.ts)
    if (data.tagName === "style") {
      const sheet = cleanStyleSheet(node.textContent ?? "")
      if (sheet === "") {
        node.parentNode?.removeChild(node)
      } else {
        node.textContent = sheet
      }
    }
  })
  purify.addHook("uponSanitizeAttribute", (_node, data: UponSanitizeAttributeHookEvent) => {
    const name = data.attrName.toLowerCase()
    if (LINKS.has(name)) {
      data.keepAttr = data.attrValue.trim().startsWith("#")
    } else if (name.startsWith("on")) {
      data.keepAttr = false
    } else if (name === "style") {
      const kept = cleanDeclarations(data.attrValue)
      data.keepAttr = kept !== null
      data.attrValue = kept ?? ""
    } else if (valueReachesOut(data.attrValue)) {
      data.keepAttr = false
    }
  })
}

const CONFIG: Config & { RETURN_DOM: true } = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS,
  // Added to DOMPurify's own list, which keeps `style`, `script` and the rest
  ADD_FORBID_CONTENTS: FORBID_CONTENTS,
  ALLOW_DATA_ATTR: false,
  RETURN_DOM: true,
}

/** The SVG as it may be stored, or a `ValidationError` (`upload.svg_*`). */
export function sanitizeSvg(bytes: Uint8Array, maxBytes = SVG_MAX_BYTES): CleanSvg {
  if (bytes.length > maxBytes) {
    refuse("upload.svg_too_large")
  }
  const text = decode(bytes)
  const { window } = new JSDOM("")
  try {
    measure(window, text)
    const purify = createDOMPurify(window)
    addHooks(purify)
    // RETURN_DOM: the cleaned `<body>`, an element of jsdom's window
    const body = purify.sanitize(text, CONFIG) as unknown as Element
    const roots = Array.from(body.children)
    const svg = roots[0]
    if (roots.length !== 1 || svg?.namespaceURI !== SVG_NS || svg.localName !== "svg") {
      return refuse("upload.svg_invalid")
    }
    // Nothing left to draw (it was all script or foreign content): no picture
    if (svg.children.length === 0) {
      return refuse("upload.svg_invalid")
    }
    const box = boxOf(svg)
    if (number(svg.getAttribute("width")) === null) {
      svg.setAttribute("width", String(box.width))
    }
    if (number(svg.getAttribute("height")) === null) {
      svg.setAttribute("height", String(box.height))
    }
    const xml = new window.XMLSerializer().serializeToString(svg)
    // A form check only (the cleaning is above): what is stored reads back as one SVG document
    const check = new window.DOMParser().parseFromString(xml, SVG_MIME)
    if (
      check.getElementsByTagName("parsererror").length > 0 ||
      check.documentElement.localName !== "svg"
    ) {
      return refuse("upload.svg_invalid")
    }
    const buffer = Buffer.from(xml, "utf8")
    if (buffer.length > maxBytes) {
      refuse("upload.svg_too_large")
    }
    return { buffer, ...box }
  } finally {
    window.close()
  }
}
