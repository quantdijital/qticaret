import createDOMPurify from "dompurify"
import type {
  Config,
  UponSanitizeAttributeHookEvent,
  UponSanitizeElementHookEvent,
} from "dompurify"
// jsdom 26: the last line without an ES module dependency, which Jest's CommonJS runtime
// (the unit tests) cannot load; it parses only, no script ever runs in it
import { JSDOM } from "jsdom"
import { cleanDeclarations, cleanStyleSheet, valueReachesOut } from "./svg-css"
import {
  SVG_MAX_ALL_ATTRIBUTES,
  SVG_MAX_ATTRIBUTES,
  SVG_MAX_DEPTH,
  SVG_MAX_ELEMENTS,
  SVG_MAX_VALUE,
  SVG_DEFAULT_SIDE,
  plainNumber,
  prescan,
} from "./svg-scan"

/**
 * The SVG cleaner itself (the owner, 2026-11-16: "logoyu svg olarak eklemek
 * istiyorum"). It runs in a worker thread only (`svg.ts`, with a hard time
 * and memory limit): an SVG is a document that can carry script, and a
 * parser or cleaner can be made to spend long on one. Parsed and cleaned
 * by DOMPurify (its SVG profile) over jsdom, then held to an allow list.
 * Gone: scripts, `foreignObject`, frames and embeds, `<use>` (outside
 * DOMPurify's SVG profile for its past bypasses), every animation (one can
 * rewrite an `href`), every `on*` handler, raster images, every reference
 * out of the document (`href` keeps `#id` only), every attribute value
 * with an escape, an at-rule, an image function or a `url()` to anything
 * but an `#id`, and the DOCTYPE with its entities (the HTML parser expands
 * none: no XXE, no "billion laughs"). CSS (a `<style>` sheet, a `style`
 * attribute) is rebuilt from an allow list (`svg-css.ts`). Elements,
 * depth and attributes are measured before DOMPurify reads it (the text,
 * `svg-scan.ts`, then the parsed tree). What is left must be one `<svg>`;
 * it is written out again as XML, with a width and height from its
 * `viewBox` when it named none (pages reserve its box: no layout shift).
 */

const SVG_MAX_SIDE = 10_000
const SVG_NS = "http://www.w3.org/2000/svg"
const SVG_MIME = "image/svg+xml"

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
  // Outside DOMPurify's SVG profile already; named here so no profile change lets it in
  "use",
  "a",
]
// DOMPurify reads tag names lower-cased from the HTML parser; both spellings, to be sure
const FORBID_TAGS = [...new Set([...FORBIDDEN, ...FORBIDDEN.map((tag) => tag.toLowerCase())])]
// Taken with everything inside them (a link's shapes stay: it is only unwrapped)
const FORBID_CONTENTS = FORBID_TAGS.filter((tag) => tag !== "a")

const LINKS = new Set(["href", "xlink:href"])

/**
 * A refusal of the file, by its `upload.svg_*` key. Its own small class, not
 * the app's `ValidationError`: the worker loads this module and its
 * imports alone (DOMPurify, jsdom, svg-css, svg-scan), nothing of the app's
 * (`svg.ts` turns the key into a `ValidationError`).
 */
export class SvgRefusal extends Error {
  constructor(readonly safeMessage: string) {
    super(safeMessage)
    this.name = "SvgRefusal"
  }
}

const refuse = (code: string): never => {
  throw new SvgRefusal(code)
}

function decode(bytes: Uint8Array): string {
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return refuse("upload.svg_invalid")
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/** The four numbers of a `viewBox`, read by hand (no pattern runs on the value). */
function viewBoxOf(value: string | null): number[] {
  if (value === null || value.length > 256) {
    return []
  }
  return value
    .replaceAll(",", " ")
    .replaceAll("\t", " ")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ")
    .split(" ")
    .filter((part) => part.trim() !== "")
    .map((part) => Number(part.trim()))
}

/** Width and height: the attributes when they are plain numbers, else the `viewBox`'s. */
function boxOf(svg: Element): { width: number; height: number } {
  const view = viewBoxOf(svg.getAttribute("viewBox"))
  const fromView =
    view.length === 4 && view.every(Number.isFinite) && (view[2] ?? 0) > 0 && (view[3] ?? 0) > 0
      ? { width: view[2] ?? 0, height: view[3] ?? 0 }
      : null
  const width = plainNumber(svg.getAttribute("width")) ?? fromView?.width ?? SVG_DEFAULT_SIDE
  const height = plainNumber(svg.getAttribute("height")) ?? fromView?.height ?? SVG_DEFAULT_SIDE
  const clamp = (side: number) => Math.min(SVG_MAX_SIDE, Math.max(1, Math.round(side)))
  return { width: clamp(width), height: clamp(height) }
}

/**
 * Elements, depth and attributes counted again on the parsed tree with a
 * stack (no recursion): the parser's tree, not the text's guess.
 */
function checkShape(root: Element): void {
  const stack: [Element, number][] = [[root, 0]]
  let count = 0
  let attributes = 0
  for (let next = stack.pop(); next; next = stack.pop()) {
    const [node, depth] = next
    attributes += node.attributes.length
    if (
      // A template's content is a fragment apart, which `children` does not walk: none at all
      node.localName === "template" ||
      depth > SVG_MAX_DEPTH ||
      ++count > SVG_MAX_ELEMENTS ||
      node.attributes.length > SVG_MAX_ATTRIBUTES ||
      attributes > SVG_MAX_ALL_ATTRIBUTES ||
      Array.from(node.attributes).some((attribute) => attribute.value.length > SVG_MAX_VALUE)
    ) {
      refuse("upload.svg_too_complex")
    }
    for (const child of Array.from(node.children)) {
      stack.push([child, depth + 1])
    }
  }
}

/** Measures before cleaning: the text, then the parsed tree; or a refusal. */
function measure(window: JSDOM["window"], text: string): void {
  const scanned = prescan(text)
  if (scanned) {
    refuse(scanned)
  }
  try {
    const parsed = new window.DOMParser().parseFromString(text, "text/html")
    checkShape(parsed.body)
  } catch (error) {
    if (error instanceof SvgRefusal) {
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

/**
 * The SVG as it may be stored, or an `SvgRefusal` (`upload.svg_*`).
 * Synchronous and unbounded in time: call it through `sanitizeSvg`
 * (`svg.ts`), which runs it in a worker with hard limits; the tests call
 * it directly for what it keeps and drops.
 */
export function cleanSvg(bytes: Uint8Array, maxBytes: number): CleanSvg {
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
    if (plainNumber(svg.getAttribute("width")) === null) {
      svg.setAttribute("width", String(box.width))
    }
    if (plainNumber(svg.getAttribute("height")) === null) {
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
