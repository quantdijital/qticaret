import type {
  AnySection,
  HomeSection,
  LayoutDocument,
  LayoutGroup,
} from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS } from "@/features/storefront/api/layout"
import { copyOf, findSection, idsOf, newSectionId } from "./sections"

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
  /** A home section to a new place among the home sections. */
  | { type: "move"; id: string; to: number }
  | { type: "duplicate"; id: string }
  | { type: "remove"; id: string }
  | { type: "toggle"; id: string }
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
  // The header and the footer hold one section of a type; the home page has a limit
  const full =
    group === "home"
      ? sections.length >= LAYOUT_LIMITS.home
      : sections.some((each) => each.type === section.type)
  if (full || idsOf(doc).has(section.id)) {
    return doc
  }
  const place = at === undefined ? sections.length : Math.max(0, Math.min(at, sections.length))
  sections.splice(place, 0, section)
  return withGroup(doc, group, sections as never)
}

function move(doc: LayoutDocument, id: string, to: number): LayoutDocument {
  const from = doc.home.findIndex((section) => section.id === id)
  const target = Math.max(0, Math.min(to, doc.home.length - 1))
  if (from < 0 || from === target) {
    return doc
  }
  const home = [...doc.home]
  const [moved] = home.splice(from, 1) as [HomeSection]
  home.splice(target, 0, moved)
  return { ...doc, home }
}

function duplicate(doc: LayoutDocument, id: string): LayoutDocument {
  const found = findSection(doc, id)
  // Only the home page holds several of a kind
  if (found?.group !== "home" || doc.home.length >= LAYOUT_LIMITS.home) {
    return doc
  }
  const copy = copyOf(found.section, newSectionId(idsOf(doc)))
  return add(doc, "home", copy, found.index + 1)
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
    case "duplicate":
      return commit(state, duplicate(doc, action.id))
    case "remove":
      return commit(
        state,
        inGroupOf(doc, action.id, (sections, index) => sections.filter((_, at) => at !== index))
      )
    case "toggle":
      return commit(
        state,
        inGroupOf(doc, action.id, (sections, index) =>
          sections.map((each, at) => (at === index ? { ...each, visible: !each.visible } : each))
        )
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
