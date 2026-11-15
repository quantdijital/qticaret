import type {
  AnySection,
  CategorySection,
  LayoutDocument,
  LayoutGroup,
  LayoutSettings,
  Placement,
} from "@/features/storefront/api/layout"
import {
  copyOf,
  findSection,
  groupLimit,
  idsOf,
  isBodyGroup,
  newSectionId,
  placed,
} from "./sections"
import { bodyOf, categoryBody, isMain, withBody } from "./main-sections"

/**
 * The theme editor's working document with its history: every change is
 * a step back (undo) and forward (redo). Typing in one field is one step,
 * however many letters it takes: a change carrying the same `merge` key as
 * the step before replaces it instead of adding another.
 */
export interface EditorState {
  doc: LayoutDocument
  past: LayoutDocument[]
  future: LayoutDocument[]
  /** The key of the last change, while typing continues in the same field. */
  merge: string | null
}

export type EditorAction =
  /** A document from the server (opened, discarded, restored): no step to undo. */
  | { type: "load"; doc: LayoutDocument }
  | { type: "add"; group: LayoutGroup; section: AnySection; at?: number }
  /** A section's new settings; `merge` names the field being typed in. */
  | { type: "update"; section: AnySection; merge?: string | undefined }
  /**
   * A page's section to a new place in its list: the home or product page's
   * sections, or those on its side of a category page's products.
   */
  | { type: "move"; id: string; to: number }
  /** A category page's section to the other side of its products. */
  | { type: "place"; id: string; placement: Placement }
  /** `copyId`: the copy's id, chosen beforehand so the preview can scroll to it (else a new one). */
  | { type: "duplicate"; id: string; copyId?: string }
  | { type: "remove"; id: string }
  | { type: "toggle"; id: string }
  /**
   * The theme's shared settings (adr/0049 Ek 2026-11-06): the trust badges,
   * the colour names, "Az kaldı"; `merge` names the field being typed in.
   */
  | { type: "settings"; settings: LayoutSettings; merge?: string | undefined }
  | { type: "undo" }
  | { type: "redo" }

/** Steps kept to go back. */
export const HISTORY_LIMIT = 100

export const initialEditorState = (doc: LayoutDocument): EditorState => ({
  doc,
  past: [],
  future: [],
  merge: null,
})

function commit(state: EditorState, doc: LayoutDocument, merge: string | null = null) {
  if (doc === state.doc) {
    return state
  }
  if (merge !== null && merge === state.merge) {
    return { ...state, doc, future: [] }
  }
  return {
    doc,
    past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
    future: [],
    merge,
  }
}

/** The document with one group's sections replaced. */
const withGroup = <G extends LayoutGroup>(
  doc: LayoutDocument,
  group: G,
  sections: LayoutDocument[G]
): LayoutDocument => ({ ...doc, [group]: sections })

/** One group's sections changed by `change`; the section's own group, whichever it is. */
function inGroupOf(
  doc: LayoutDocument,
  id: string,
  change: (sections: AnySection[], index: number) => AnySection[]
): LayoutDocument {
  const found = findSection(doc, id)
  if (!found) {
    return doc
  }
  const sections: AnySection[] = [...doc[found.group]]
  return withGroup(doc, found.group, change(sections, found.index) as never)
}

function add(doc: LayoutDocument, group: LayoutGroup, section: AnySection, at?: number) {
  const sections: AnySection[] = [...doc[group]]
  // A page's body has a limit; the header and the footer hold one section of a type
  const full = isBodyGroup(group)
    ? bodyOf(doc, group).length >= groupLimit(group) || isMain(section)
    : sections.some((each) => each.type === section.type)
  if (full || idsOf(doc).has(section.id)) {
    return doc
  }
  const place = at === undefined ? sections.length : Math.max(0, Math.min(at, sections.length))
  sections.splice(place, 0, section)
  return withGroup(doc, group, sections as never)
}

/** The list with one item moved to `to` (held within it); the same list when nothing moves. */
function reorder<T extends { id: string }>(list: readonly T[], id: string, to: number) {
  const from = list.findIndex((each) => each.id === id)
  const target = Math.max(0, Math.min(to, list.length - 1))
  if (from < 0 || from === target) {
    return list
  }
  const next = [...list]
  const [moved] = next.splice(from, 1) as [T]
  next.splice(target, 0, moved)
  return next
}

function move(doc: LayoutDocument, id: string, to: number): LayoutDocument {
  const found = findSection(doc, id)
  if (!found || !isBodyGroup(found.group) || isMain(found.section)) {
    return doc
  }
  if (found.group === "category") {
    // Above and below the products are two lists: the section moves within its own
    const { placement } = found.section as CategorySection
    const list = placed(doc.category, placement)
    const moved = reorder(list, id, to)
    if (moved === list) {
      return doc
    }
    const top = placement === "top" ? moved : placed(doc.category, "top")
    const bottom = placement === "bottom" ? moved : placed(doc.category, "bottom")
    return { ...doc, category: withBody(doc.category, [...top, ...bottom]) }
  }
  // The list's places are the body's: the page's main section stays first
  const list: readonly AnySection[] = bodyOf(doc, found.group)
  const moved = reorder(list, id, to)
  return moved === list
    ? doc
    : withGroup(doc, found.group, withBody(doc[found.group] as AnySection[], moved) as never)
}

function place(doc: LayoutDocument, id: string, placement: Placement): LayoutDocument {
  const section = categoryBody(doc).find((each) => each.id === id)
  if (!section || section.placement === placement) {
    return doc
  }
  const others = doc.category.filter((each) => each.id !== id)
  return {
    ...doc,
    category: withBody(doc.category, [
      ...placed(others, "top"),
      { ...section, placement },
      ...placed(others, "bottom"),
    ]),
  }
}

function duplicate(doc: LayoutDocument, id: string, copyId?: string): LayoutDocument {
  const found = findSection(doc, id)
  // Only a page's body holds several of a kind
  if (
    !found ||
    !isBodyGroup(found.group) ||
    isMain(found.section) ||
    bodyOf(doc, found.group).length >= groupLimit(found.group)
  ) {
    return doc
  }
  const taken = idsOf(doc)
  const copy = copyOf(found.section, copyId && !taken.has(copyId) ? copyId : newSectionId(taken))
  return add(doc, found.group, copy, found.index + 1)
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { doc } = state
  switch (action.type) {
    case "load":
      return initialEditorState(action.doc)
    case "add":
      return commit(state, add(doc, action.group, action.section, action.at))
    case "update":
      return commit(
        state,
        inGroupOf(doc, action.section.id, (sections, index) =>
          sections.map((each, at) => (at === index ? action.section : each))
        ),
        action.merge ?? null
      )
    case "move":
      return commit(state, move(doc, action.id, action.to))
    case "place":
      return commit(state, place(doc, action.id, action.placement))
    case "duplicate":
      return commit(state, duplicate(doc, action.id, action.copyId))
    // A main section is never removed nor hidden (adr/0049 Ek 2026-11-14 §5)
    case "remove":
      return commit(
        state,
        inGroupOf(doc, action.id, (sections, index) =>
          sections.filter((each, at) => at !== index || isMain(each))
        )
      )
    case "toggle":
      return commit(
        state,
        inGroupOf(doc, action.id, (sections, index) =>
          sections.map((each, at) =>
            at === index && !isMain(each) ? { ...each, visible: !each.visible } : each
          )
        )
      )
    case "settings":
      return commit(
        state,
        action.settings === doc.settings ? doc : { ...doc, settings: action.settings },
        action.merge === undefined ? null : `settings:${action.merge}`
      )
    case "undo": {
      const previous = state.past.at(-1)
      return previous
        ? {
            doc: previous,
            past: state.past.slice(0, -1),
            future: [doc, ...state.future],
            merge: null,
          }
        : state
    }
    case "redo": {
      const [next, ...rest] = state.future
      return next ? { doc: next, past: [...state.past, doc], future: rest, merge: null } : state
    }
  }
}
