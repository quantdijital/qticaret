import { DEFAULTS } from "./types.ts"
import type { Capture, ElementStyle } from "./types.ts"

/**
 * The resolved style check's comparison (adr/0067 §3, step 0b): two
 * captures of the same page, width and state, element by element. Pure:
 * `diff-cli.ts` reads the folders, `report.ts` prints the result.
 */

export interface DiffOptions {
  /** Pixel differences up to this much are the same drawing (subpixel rounding). */
  tolerance: number
}

export interface PropChange {
  prop: string
  before: string
  after: string
}

export interface ElementRef {
  key: string
  text: string
}

export interface ElementChange extends ElementRef {
  changes: PropChange[]
}

export interface CaptureDiff {
  file: string
  page: string
  path: string
  width: number
  state: string
  /** Elements only the new capture has: the DOM changed, apart from any style. */
  added: ElementRef[]
  removed: ElementRef[]
  changed: ElementChange[]
}

const PX = /(-?\d*\.?\d+px)/

/** A property's value as drawn: what the capture holds, else the property's default. */
function valueOf(style: ElementStyle | undefined, prop: string): string {
  const value = style?.s[prop]
  if (value === undefined) {
    return DEFAULTS[prop] ?? "-"
  }
  return String(value)
}

/** Same drawing: equal, or equal but for pixel lengths no further apart than the tolerance. */
export function sameValue(before: string, after: string, tolerance: number): boolean {
  if (before === after) {
    return true
  }
  if (tolerance <= 0) {
    return false
  }
  const a = Number(before)
  const b = Number(after)
  if (before !== "" && after !== "" && Number.isFinite(a) && Number.isFinite(b)) {
    return Math.abs(a - b) <= tolerance
  }
  const left = before.split(PX)
  const right = after.split(PX)
  if (left.length !== right.length) {
    return false
  }
  return left.every((part, i) => {
    const other = right[i] ?? ""
    if (i % 2 === 0) {
      return part === other
    }
    return Math.abs(parseFloat(part) - parseFloat(other)) <= tolerance
  })
}

/** What changed between two captures of one page, width and state. */
export function diffCaptures(
  file: string,
  before: Capture,
  after: Capture,
  options: DiffOptions
): CaptureDiff {
  const result: CaptureDiff = {
    file,
    page: after.page,
    path: after.path,
    width: after.width,
    state: after.state,
    added: [],
    removed: [],
    changed: [],
  }
  for (const [key, old] of Object.entries(before.elements)) {
    const now = after.elements[key]
    if (!now) {
      result.removed.push({ key, text: old.t ?? "" })
      continue
    }
    const props = new Set([...Object.keys(old.s), ...Object.keys(now.s)])
    const changes: PropChange[] = []
    for (const prop of props) {
      const was = valueOf(old, prop)
      const is = valueOf(now, prop)
      if (!sameValue(was, is, options.tolerance)) {
        changes.push({ prop, before: was, after: is })
      }
    }
    if (changes.length > 0) {
      result.changed.push({ key, text: now.t ?? old.t ?? "", changes })
    }
  }
  for (const [key, now] of Object.entries(after.elements)) {
    if (!(key in before.elements)) {
      result.added.push({ key, text: now.t ?? "" })
    }
  }
  return result
}

export function isSame(diff: CaptureDiff): boolean {
  return diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0
}

/** The parent element's key: the path without its last step (a section's anchor has none). */
export function parentKey(key: string): string | null {
  const plain = key.replace(/::(before|after)$/, "")
  if (plain !== key) {
    return plain
  }
  const cut = key.lastIndexOf(" > ")
  return cut === -1 ? null : key.slice(0, cut)
}

/**
 * The tops of a set of added or removed elements: those whose parent is
 * not in the set too, each with how many of the set lie beneath it. A
 * wrapper added around a list reads as one change, not as every item.
 */
export function subtreeRoots(refs: ElementRef[]): { ref: ElementRef; inside: number }[] {
  const keys = new Set(refs.map((ref) => ref.key))
  const roots = new Map<string, { ref: ElementRef; inside: number }>()
  const rootOf = (key: string): string => {
    let top = key
    for (let up = parentKey(top); up !== null && keys.has(up); up = parentKey(top)) {
      top = up
    }
    return top
  }
  for (const ref of refs) {
    const top = rootOf(ref.key)
    const entry = roots.get(top) ?? {
      ref: refs.find((each) => each.key === top) ?? ref,
      inside: 0,
    }
    if (top !== ref.key) {
      entry.inside += 1
    }
    roots.set(top, entry)
  }
  return [...roots.values()]
}

/**
 * The same change on many elements (a colour every link inherits) is one
 * line: grouped by property and its values, elements in document order.
 */
export function groupChanges(
  changed: ElementChange[]
): { change: PropChange; elements: ElementRef[] }[] {
  const groups = new Map<string, { change: PropChange; elements: ElementRef[] }>()
  for (const element of changed) {
    for (const change of element.changes) {
      const id = `${change.prop}\u0000${change.before}\u0000${change.after}`
      const group = groups.get(id) ?? { change, elements: [] }
      group.elements.push({ key: element.key, text: element.text })
      groups.set(id, group)
    }
  }
  return [...groups.values()]
}
