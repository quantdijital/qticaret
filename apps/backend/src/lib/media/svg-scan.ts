/**
 * Reads of an SVG's text before anything parses it (`svg.ts`): plain
 * character loops and `indexOf`, every one linear in the text. No regular
 * expression with a quantifier runs on the text here: the earlier ones
 * backtracked (a file of comments, a run of `<a`, a long run of spaces
 * held the process for seconds or for good, security review 2026-11-16).
 * Every loop moves its position forward on every turn, or stops: a loop
 * that could stand still (`<!----><!doctype [>` did) is a hang on the
 * event loop. Each says below why it ends.
 */

/** The most elements, nesting, attributes on one element and in all that an SVG may have. */
export const SVG_MAX_ELEMENTS = 5_000
export const SVG_MAX_DEPTH = 64
export const SVG_MAX_ATTRIBUTES = 64
export const SVG_MAX_ALL_ATTRIBUTES = 20_000
/** One attribute's value at most (a path's `d` can be long: a whole logo's outline). */
export const SVG_MAX_VALUE = 100_000

/** The box of an SVG that names no size of any kind. */
export const SVG_DEFAULT_SIDE = 512

/** How far into a file its start is looked for. */
const HEAD = 4_096

const isSpace = (code: number) =>
  code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d || code === 0x0c
const isLetter = (code: number) => (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)

// Ends: `at` grows by one each turn, up to the text's length
function skipSpaces(text: string, from: number): number {
  let at = from
  while (at < text.length && isSpace(text.charCodeAt(at))) {
    at++
  }
  return at
}

const startsWithAt = (text: string, at: number, word: string): boolean =>
  text.slice(at, at + word.length).toLowerCase() === word

/** Where a DOCTYPE that starts at `at` ends (after its `>`), or -1: never closed. */
function doctypeEnd(text: string, at: number): number {
  const close = text.indexOf(">", at)
  if (close < 0) {
    return -1
  }
  // A `[` only before the first `>` opens an internal subset: looked for there alone
  const subset = text.slice(at, close).indexOf("[")
  if (subset < 0) {
    return close + 1
  }
  // An internal subset `[ … ]` may hold `>`: the DOCTYPE ends at the first `>` after its `]`
  const bracket = text.indexOf("]", at + subset)
  if (bracket < 0) {
    return -1
  }
  const end = text.indexOf(">", bracket)
  return end < 0 ? -1 : end + 1
}

/**
 * A detection, not a cleaner: does the file start as an SVG document? A
 * byte order mark and spaces, an optional `<?xml …?>`, comments and a
 * DOCTYPE (its internal subset too) in any order, then `<svg` and a space
 * or `>`; within the first 4 KB, or it is no SVG.
 */
export function looksLikeSvg(bytes: Uint8Array): boolean {
  let text = Buffer.from(bytes.subarray(0, HEAD)).toString("utf8")
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  let at = skipSpaces(text, 0)
  if (startsWithAt(text, at, "<?xml")) {
    const end = text.indexOf("?>", at)
    if (end < 0) {
      return false
    }
    at = skipSpaces(text, end + 2)
  }
  // Ends: each turn moves `at` past what it read, or returns; one that would not move returns
  for (;;) {
    let end: number
    if (startsWithAt(text, at, "<!--")) {
      end = commentEnd(text, at)
    } else if (startsWithAt(text, at, "<!doctype")) {
      end = doctypeEnd(text, at)
    } else {
      break
    }
    if (end <= at || end > text.length) {
      return false
    }
    at = skipSpaces(text, end)
  }
  if (!startsWithAt(text, at, "<svg")) {
    return false
  }
  const next = text.charCodeAt(at + 4)
  return isSpace(next) || next === 0x3e
}

/** A width or height of plain digits (and `px`), else null; never a long string. */
export function plainNumber(value: string | null): number | null {
  if (value === null || value.length > 32) {
    return null
  }
  const text = value.trim()
  if (!/^\d+(\.\d+)?(px)?$/.test(text)) {
    return null
  }
  const parsed = Number.parseFloat(text)
  return parsed > 0 ? parsed : null
}

export type ScanRefusal = "upload.svg_too_complex"

/**
 * Where a comment that starts at `at` (`<!--`) ends, as an HTML parser
 * reads it: `<!-->` and `<!--->` are empty, `-->` and `--!>` close it, one
 * never closed runs to the end. Ends: `index` grows by one each turn.
 */
function commentEnd(text: string, at: number): number {
  if (text.startsWith(">", at + 4)) {
    return at + 5
  }
  if (text.startsWith("->", at + 4)) {
    return at + 6
  }
  for (let index = at + 4; index < text.length; index++) {
    if (text.charCodeAt(index) === 0x2d && text.charCodeAt(index + 1) === 0x2d) {
      if (text.charCodeAt(index + 2) === 0x3e) {
        return index + 3
      }
      if (text.charCodeAt(index + 2) === 0x21 && text.charCodeAt(index + 3) === 0x3e) {
        return index + 4
      }
    }
  }
  return text.length
}

interface Tag {
  name: string
  /** Just past the tag's `>` (quotes respected), or the text's end. */
  end: number
  attributes: number
  /** A `/` right before the `>`, outside any value (`<g a=/>` is no self-closing tag). */
  selfClosing: boolean
}

/**
 * The tag from `at` (just after `<` or `</`): its name, then its
 * attributes read as the HTML tokenizer reads them, a quoted value whole
 * (a `>` in it does not end the tag), every name counted with or without
 * a value. Ends: `index` grows by at least one each turn, up to the end.
 */
function readTag(text: string, at: number): Tag {
  let index = at
  while (index < text.length) {
    const code = text.charCodeAt(index)
    if (isSpace(code) || code === 0x2f || code === 0x3e) {
      break
    }
    index++
  }
  const name = text.slice(at, index).toLowerCase()
  let attributes = 0
  let selfClosing = false
  while (index < text.length) {
    const code = text.charCodeAt(index)
    if (code === 0x3e) {
      return { name, end: index + 1, attributes, selfClosing }
    }
    if (isSpace(code)) {
      index++
      continue
    }
    if (code === 0x2f) {
      selfClosing = text.charCodeAt(index + 1) === 0x3e
      index++
      continue
    }
    selfClosing = false
    // An attribute's name, up to a space, `=`, `/` or `>`
    attributes++
    while (index < text.length) {
      const c = text.charCodeAt(index)
      if (isSpace(c) || c === 0x3d || c === 0x2f || c === 0x3e) {
        break
      }
      index++
    }
    index = skipSpaces(text, index)
    if (text.charCodeAt(index) !== 0x3d) {
      continue
    }
    index = skipSpaces(text, index + 1)
    const quote = text.charCodeAt(index)
    if (quote === 0x22 || quote === 0x27) {
      const close = text.indexOf(String.fromCharCode(quote), index + 1)
      index = close < 0 ? text.length : close + 1
    } else {
      // Unquoted: up to a space or `>` (a `/` in it is the value's, not a self-closing mark)
      while (index < text.length) {
        const c = text.charCodeAt(index)
        if (isSpace(c) || c === 0x3e) {
          break
        }
        index++
      }
    }
  }
  return { name, end: text.length, attributes, selfClosing: false }
}

/**
 * Where a self-closing mark is honoured: on an element of the SVG's own
 * namespace. Inside an HTML integration point (`foreignObject`, `desc`,
 * `title`) or for an HTML element that breaks out of it, the HTML parser
 * ignores it: the element stays open.
 */
const INTEGRATION_POINTS = new Set(["foreignobject", "desc", "title"])
const BREAKOUT = new Set([
  ..."b big blockquote body br center code dd div dl dt em embed h1 h2 h3 h4 h5 h6 head hr i img li listing menu meta nobr ol p pre ruby s small span strong strike sub sup table tt u ul var".split(
    " "
  ),
])

function inSvgContent(open: readonly string[]): boolean {
  for (let index = open.length - 1; index >= 0; index--) {
    const name = open[index] ?? ""
    if (name === "svg") {
      return true
    }
    if (INTEGRATION_POINTS.has(name)) {
      return false
    }
  }
  return false
}

/**
 * A look at the text before it is parsed: elements (start tags), nesting
 * as an HTML parser would mostly follow it (an end tag closes the nearest
 * open element of its name, one with none open is ignored; a self-closing
 * mark counts only on an SVG element), attributes on each element and in
 * all (with or without a value), and no `<template>` (its content is no
 * child the tree counts). Comments, empty ones and `--!>` too, and other
 * markup declarations are skipped. A guess, not the parser: it can still
 * count less than the tree in HTML corners (implied end tags, adoption),
 * which is why the worker counts the parsed tree again before cleaning.
 * Ends: `at` moves past each piece it reads (at least one character).
 */
export function prescan(text: string): ScanRefusal | null {
  const open: string[] = []
  let elements = 0
  let attributes = 0
  let at = text.indexOf("<")
  while (at >= 0 && at < text.length) {
    const next = text.charCodeAt(at + 1)
    let end: number
    if (text.startsWith("<!--", at)) {
      end = commentEnd(text, at)
    } else if (next === 0x21 || next === 0x3f) {
      // `<!DOCTYPE …>`, `<![CDATA[`, `<?…>`: up to its `>`
      const close = text.indexOf(">", at)
      end = close < 0 ? text.length : close + 1
    } else if (next === 0x2f && isLetter(text.charCodeAt(at + 2))) {
      const tag = readTag(text, at + 2)
      const index = open.lastIndexOf(tag.name)
      if (index >= 0) {
        open.length = index
      }
      end = tag.end
    } else if (isLetter(next)) {
      const tag = readTag(text, at + 1)
      elements++
      attributes += tag.attributes
      if (
        tag.name === "template" ||
        elements > SVG_MAX_ELEMENTS ||
        tag.attributes > SVG_MAX_ATTRIBUTES ||
        attributes > SVG_MAX_ALL_ATTRIBUTES
      ) {
        return "upload.svg_too_complex"
      }
      const closesItself =
        tag.selfClosing && !BREAKOUT.has(tag.name) && (tag.name === "svg" || inSvgContent(open))
      if (!closesItself) {
        open.push(tag.name)
        if (open.length > SVG_MAX_DEPTH) {
          return "upload.svg_too_complex"
        }
      }
      end = tag.end
    } else {
      end = at + 1
    }
    at = text.indexOf("<", Math.max(end, at + 1))
  }
  return null
}
