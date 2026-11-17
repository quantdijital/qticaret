import { searchText } from "./settings-search"

/**
 * What a settings panel's own search reads (adr/0065 Ek, sekmeler): the
 * fields the panel draws, every tab and every closed group (they stay in
 * the page, hidden), as the shop reads them: a field's name, the small
 * technical term beside it, its help text and its choices' names. Read
 * from the drawn panel rather than a second list, so a field a form adds
 * is found the day it is drawn, under the group it is drawn in.
 */

export interface PanelField {
  /** The field's block: brought into view and marked. */
  element: HTMLElement
  /** Its control: focused. */
  control: HTMLElement
  /** The panel group it sits in (`data-panel-group`). */
  group: string
  groupTitle: string
  label: string
  term: string | null
  hint: string
  options: readonly string[]
}

const CONTROLS = [
  '[role="radiogroup"]',
  '[role="group"][aria-labelledby]:not([data-panel-group])',
  'input:not([type="hidden"]):not([aria-hidden="true"])',
  "textarea",
  'button[role="switch"]',
  'button[role="combobox"]',
  "select:not([aria-hidden='true'])",
].join(", ")

const textOf = (element: Element | null | undefined): string =>
  (element?.textContent ?? "").replace(/\s+/g, " ").trim()

const byIds = (root: ParentNode, ids: string | null): HTMLElement[] =>
  (ids ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((id) => {
      const found = root.ownerDocument?.getElementById(id) ?? document.getElementById(id)
      return found ? [found] : []
    })

/** The control's own label element (`aria-labelledby`, `label[for]` or the label around it). */
function labelOf(control: HTMLElement, labels: ReadonlyMap<string, HTMLElement>) {
  const [named] = byIds(control.ownerDocument, control.getAttribute("aria-labelledby"))
  return named ?? (control.id ? labels.get(control.id) : undefined) ?? control.closest("label")
}

/** The label's own words and its term, the help text inside it set apart. */
function splitLabel(label: HTMLElement | null | undefined, control: HTMLElement) {
  if (!label) {
    return { label: control.getAttribute("aria-label") ?? "", term: null, inner: "" }
  }
  const copy = label.cloneNode(true) as HTMLElement
  const term = copy.querySelector("small")
  const termText = textOf(term)
  term?.remove()
  // The help text a switch's label holds under its name (`SwitchRow`)
  const inner = [...copy.querySelectorAll(".text-xs, p")].map((hint) => {
    const words = textOf(hint)
    hint.remove()
    return words
  })
  return { label: textOf(copy), term: termText || null, inner: inner.join(" ") }
}

/** The lowest block holding both the label and the control: the field's own. */
function blockOf(control: HTMLElement, label: HTMLElement | null | undefined, stop: HTMLElement) {
  let block: HTMLElement = control
  if (label) {
    while (block.parentElement && block !== stop && !block.contains(label)) {
      block = block.parentElement
    }
  }
  return block === stop ? control : block
}

/** Every field the panel draws under `root`, in its order, with its group. */
export function collectFields(root: HTMLElement): PanelField[] {
  const labels = new Map<string, HTMLElement>()
  for (const label of root.querySelectorAll<HTMLLabelElement>("label[for]")) {
    labels.set(label.htmlFor, label)
  }
  const taken: HTMLElement[] = []
  const fields: PanelField[] = []
  for (const control of root.querySelectorAll<HTMLElement>(CONTROLS)) {
    const group = control.closest<HTMLElement>("[data-panel-group]")
    // A choice inside a field already read (a radio's own input) is that field's
    if (!group || taken.some((field) => field.contains(control))) {
      continue
    }
    taken.push(control)
    const body = group.querySelector<HTMLElement>("[data-panel-group-body]") ?? group
    const labelElement = labelOf(control, labels)
    const { label, term, inner } = splitLabel(labelElement, control)
    if (label === "") {
      continue
    }
    const element = blockOf(control, labelElement, body)
    const described = byIds(control.ownerDocument, control.getAttribute("aria-describedby"))
    const hints = [...element.querySelectorAll("p")].filter((hint) => !labelElement?.contains(hint))
    fields.push({
      element,
      control,
      group: group.dataset["panelGroup"] ?? "",
      groupTitle: textOf(group.querySelector("[data-panel-group-title]")),
      label,
      term,
      // The (i)'s hidden words are both the control's description and a `p` in its block: once
      hint: [...new Set([inner, ...[...described, ...hints].map(textOf)].filter(Boolean))].join(
        " "
      ),
      options: [...control.querySelectorAll('[role="radio"], button')]
        .map((option) => option.getAttribute("aria-label") ?? textOf(option))
        .filter(Boolean),
    })
  }
  return fields
}

export interface PanelHit {
  field: PanelField
  /** The choice whose name was found; null: none. */
  option: string | null
}

/** At most this many hits: a short query is still a list one reads. */
export const PANEL_SEARCH_LIMIT = 30

/**
 * The fields holding every word of the query (Turkish case and accents let
 * go): those found by their name or term first, then by a choice's name,
 * then by their help text or their group's title; the same name in one
 * group once (a list's repeated fields).
 */
export function searchPanel(query: string, fields: readonly PanelField[]): PanelHit[] {
  const words = searchText(query).split(" ").filter(Boolean)
  if (words.length === 0) {
    return []
  }
  const all = (text: string) => words.every((word) => text.includes(word))
  const ranked: { hit: PanelHit; rank: number }[] = []
  const seen = new Set<string>()
  for (const field of fields) {
    const own = searchText(`${field.label} ${field.term ?? ""}`)
    const option = field.options.find((name) =>
      words.some((word) => searchText(name).includes(word))
    )
    const chosen = option ? searchText(option) : ""
    const rest = searchText(`${field.hint} ${field.groupTitle}`)
    const rank = all(own)
      ? 0
      : all(`${own} ${chosen}`)
        ? 1
        : all(`${own} ${chosen} ${rest}`)
          ? 2
          : -1
    const key = `${field.group}:${own}`
    if (rank < 0 || seen.has(key)) {
      continue
    }
    seen.add(key)
    ranked.push({ hit: { field, option: rank === 1 ? (option ?? null) : null }, rank })
  }
  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, PANEL_SEARCH_LIMIT)
    .map(({ hit }) => hit)
}
