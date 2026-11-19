import type {
  AnySection,
  CategorySection,
  ContentPageSection,
  FooterSection,
  LayoutDocument,
  LayoutSettings,
  ListGroup,
  Placement,
} from "@/features/storefront/api/layout"
import {
  copyOf,
  findSection,
  groupLimit,
  idsOf,
  isBodyGroup,
  isPageGroup,
  newSectionId,
  placed,
} from "./sections"
import { bodyOf, categoryBody, isMain, withBody } from "./main-sections"
import {
  addToPage,
  bodyAround,
  inPageOf,
  pageSectionsOf,
  placeOnPage,
  sideOf,
  withPageSections,
  withoutPages,
} from "./page-layouts"

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
  | { type: "add"; group: ListGroup; section: AnySection; at?: number }
  /** A content page's section (adr/0073): the first one makes the page's layout. */
  | { type: "add"; group: "pages"; page: string; section: ContentPageSection; at?: number }
  /** A section's new settings; `merge` names the field being typed in. */
  | { type: "update"; section: AnySection; merge?: string | undefined }
  /**
   * A page's section to a new place in its list: the home or product page's
   * sections, or those on its side of a category page's products (a
   * content page's text).
   */
  | { type: "move"; id: string; to: number }
  /** A category (or content) page's section to the other side of its products (its text). */
  | { type: "place"; id: string; placement: Placement }
  /** `copyId`: the copy's id, chosen beforehand so the preview can scroll to it (else a new one). */
  | { type: "duplicate"; id: string; copyId?: string }
  | { type: "remove"; id: string }
  | { type: "toggle"; id: string }
  /**
   * The footer group replaced whole in one step: the footer switched to free
   * rows takes the newsletter box into a block (adr/0070 §2.4).
   */
  | { type: "footer"; sections: FooterSection[] }
  /**
   * The theme's shared settings (adr/0049 Ek 2026-11-06): the trust badges,
   * the colour names, "Az kaldı"; `merge` names the field being typed in.
   */
  | { type: "settings"; settings: LayoutSettings; merge?: string | undefined }
  /**
   * Content pages deleted since, whose layouts the server left out of a
   * save (adr/0073 §1): out of the document and its history, no step.
   */
  | { type: "drop-pages"; ids: readonly string[] }
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
const withGroup = <G extends ListGroup>(
  doc: LayoutDocument,
  group: G,
  sections: LayoutDocument[G]
): LayoutDocument => ({ ...doc, [group]: sections })

/**
 * One group's sections changed by `change`; the section's own group,
 * whichever it is (a content page's: its page, which goes with its last).
 */
function inGroupOf(
  doc: LayoutDocument,
  id: string,
  change: <S extends AnySection>(sections: S[], index: number) => S[]
): LayoutDocument {
  const found = findSection(doc, id)
  if (!found) {
    return doc
  }
  if (found.group === "pages") {
    return inPageOf(doc, found, change)
  }
  const sections: AnySection[] = [...doc[found.group]]
  return withGroup(doc, found.group, change(sections, found.index) as never)
}

function add(doc: LayoutDocument, action: Extract<EditorAction, { type: "add" }>) {
  const { section, at } = action
  if (idsOf(doc).has(section.id)) {
    return doc
  }
  if (action.group === "pages") {
    return addToPage(doc, action.page, action.section, at)
  }
  const { group } = action
  const sections: AnySection[] = [...doc[group]]
  // A page's body has a limit; the header and the footer hold one section of a type
  const full = isBodyGroup(group)
    ? bodyOf(doc, group).length >= groupLimit(group) || isMain(section)
    : sections.some((each) => each.type === section.type)
  if (full) {
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
  if (found?.group === "footer" && !isMain(found.section)) {
    // The footer group's sections above its bar (adr/0070 §4): the bar has no place in the order
    const list = doc.footer.filter((section) => !isMain(section))
    const moved = reorder(list, id, to)
    return moved === list ? doc : { ...doc, footer: withBody(doc.footer, moved) }
  }
  if (found?.group === "pages" && found.page !== null) {
    // Above and below the page's text are two lists, as a category page's
    const list = sideOf(doc, found)
    const moved = reorder(list, id, to)
    if (moved === list) {
      return doc
    }
    const others = pageSectionsOf(doc, found.page).filter((each) => !list.includes(each))
    return withPageSections(doc, found.page, [...moved, ...others])
  }
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
  const found = findSection(doc, id)
  if (found?.group === "pages") {
    return placeOnPage(doc, found, placement)
  }
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
    !isPageGroup(found.group) ||
    isMain(found.section) ||
    bodyAround(doc, found).length >= groupLimit(found.group)
  ) {
    return doc
  }
  const taken = idsOf(doc)
  const copy = copyOf(found.section, copyId && !taken.has(copyId) ? copyId : newSectionId(taken))
  if (found.group === "pages") {
    return found.page === null
      ? doc
      : addToPage(doc, found.page, copy as ContentPageSection, found.index + 1)
  }
  return add(doc, { type: "add", group: found.group, section: copy, at: found.index + 1 })
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { doc } = state
  switch (action.type) {
    case "load":
      return initialEditorState(action.doc)
    case "add":
      return commit(state, add(doc, action))
    case "update":
      return commit(
        state,
        inGroupOf(doc, action.section.id, (sections, index) =>
          sections.map((each, at) => (at === index ? (action.section as typeof each) : each))
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
    case "footer":
      return commit(state, { ...doc, footer: action.sections })
    case "settings":
      return commit(
        state,
        action.settings === doc.settings ? doc : { ...doc, settings: action.settings },
        action.merge === undefined ? null : `settings:${action.merge}`
      )
    case "drop-pages": {
      const next = withoutPages(doc, action.ids)
      return next === doc
        ? state
        : {
            ...state,
            doc: next,
            past: state.past.map((each) => withoutPages(each, action.ids)),
            future: state.future.map((each) => withoutPages(each, action.ids)),
          }
    }
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
