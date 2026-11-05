import type { Block, Inline, ListItem, Table } from "../../content/doc"
import {
  cleanLabel,
  cleanValue,
  isAllBold,
  isHeaderWord,
  isHeadingLike,
  isLabel,
  isSpecHeading,
  labelKey,
  lineFact,
  linesOf,
  runsText,
  tidy,
} from "./text"
import type { LineFact } from "./text"
import { isUnitWord } from "./units"

/**
 * The facts a product's description document states (adr/0013 Ek
 * 2026-11-05), read, never changed:
 * - a two-column table's rows (a first row of column names skipped, a
 *   one-cell row names the rows under it), or a table of one header row
 *   and one row of values;
 * - "Label: value" lines (or a bold label and its value) under a heading
 *   of facts (`SPEC_HEADINGS`, a real heading or a bold line standing as
 *   one), in paragraphs and lists, nested lists named by their parent item;
 * - elsewhere, only a list or a run of lines that are all such facts, at
 *   least two.
 * Each row keeps the path of its node in the document (`content.3.content.2`).
 */

export interface FactRow {
  label: string
  value: string
  /** The node it came from: a path into the document, the HTML or the text. */
  source_path: string
  /** What the row sits under: a table's section row, a sub-heading, a parent list item. */
  context?: string | undefined
  /** A unit the label names in brackets ("Boy (cm)"), for a number written without one. */
  unit?: string | undefined
}

const MAX_ROWS = 200
// A bold line standing as a heading: deeper than any real one
const PSEUDO = 9

interface State {
  rows: FactRow[]
  /** Facts outside a section, kept once two follow one another. */
  loose: FactRow[]
  section: { level: number } | null
  context: string | null
}

const LABEL_UNIT = /^(.*?\S)\s*[([]\s*([^()[\]]{1,12})\s*[)\]]$/

/** A row from a fact; a unit in brackets at the label's end goes to `unit`. */
export function factRow(fact: LineFact, path: string, context: string | null): FactRow {
  const bracket = LABEL_UNIT.exec(fact.label)
  const unit = bracket?.[2] && isUnitWord(bracket[2]) ? bracket[2].trim() : undefined
  const label = unit && bracket?.[1] ? cleanLabel(bracket[1]) : fact.label
  return {
    label,
    value: fact.value,
    source_path: path,
    ...(context ? { context } : {}),
    ...(unit ? { unit } : {}),
  }
}

function endLoose(state: State): void {
  if (state.loose.length >= 2) {
    state.rows.push(...state.loose)
  }
  state.loose = []
}

function visitLine(state: State, runs: Inline[], path: string): void {
  const fact = lineFact(runs, state.section !== null)
  if (fact) {
    const row = factRow(fact, path, state.context)
    if (state.section) {
      state.rows.push(row)
    } else {
      state.loose.push(row)
    }
    return
  }
  endLoose(state)
  const text = runsText(runs)
  if ((isAllBold(runs) || /[:：]$/.test(text)) && isHeadingLike(text)) {
    const title = cleanLabel(text)
    if (isSpecHeading(title)) {
      state.section = { level: PSEUDO }
      state.context = null
    } else {
      // Inside a section a sub-heading; outside, it names what follows
      state.context = title
    }
    return
  }
  // A sentence closes what a bold line opened
  if (state.section?.level === PSEUDO) {
    state.section = null
    state.context = null
  }
}

function visitHeading(state: State, text: string, level: number): void {
  endLoose(state)
  if (isSpecHeading(text)) {
    state.section = { level }
    state.context = null
  } else if (state.section && level > state.section.level) {
    state.context = text
  } else {
    state.section = null
    state.context = text
  }
}

interface ListFacts {
  rows: FactRow[]
  /** Every item that is no group's name is a fact. */
  all: boolean
}

function listFacts(items: readonly ListItem[], path: string, context: string | null): ListFacts {
  const out: ListFacts = { rows: [], all: true }
  items.forEach((item, index) => {
    const itemPath = `${path}.content.${String(index)}`
    const [first, ...rest] = item.content
    const lines = first?.type === "paragraph" ? linesOf(first.content) : []
    const nested = item.content.flatMap((child, at) =>
      child.type === "paragraph" ? [] : [{ child, at }]
    )
    const facts = lines.map((runs) => lineFact(runs, true))
    let inner = context
    if (lines.length > 0 && facts.every((fact) => fact !== null)) {
      out.rows.push(...facts.map((fact) => factRow(fact, itemPath, context)))
    } else if (lines.length === 1 && nested.length > 0 && isHeadingLike(runsText(lines[0] ?? []))) {
      // A group's name: its own list's facts sit under it
      inner = cleanLabel(runsText(lines[0] ?? []))
    } else {
      out.all = false
    }
    for (const { child, at } of nested) {
      const found = listFacts(child.content, `${itemPath}.content.${String(at)}`, inner)
      out.rows.push(...found.rows)
      out.all &&= found.all
    }
    if (rest.some((child) => child.type === "paragraph")) {
      out.all = false
    }
  })
  return out
}

function visitList(state: State, items: readonly ListItem[], path: string): void {
  endLoose(state)
  const found = listFacts(items, path, state.context)
  if (state.section || (found.all && found.rows.length >= 2)) {
    state.rows.push(...found.rows)
  }
}

interface Cell {
  text: string
  header: boolean
}

const cellsOf = (row: Table["content"][number]): Cell[] =>
  row.content.map((cell) => ({
    text: tidy(cell.content.map((paragraph) => runsText(paragraph.content ?? [])).join(" ")),
    header: cell.type === "tableHeader",
  }))

function tableRow(label: string, value: string, path: string, context: string | null) {
  const clean = cleanValue(value)
  return clean !== null && isLabel(label)
    ? [factRow({ label: cleanLabel(label), value: clean }, path, context)]
    : []
}

/** A table's facts: two columns of label and value, or one row of labels over one of values. */
export function tableFacts(table: Table, path: string, context: string | null): FactRow[] {
  const rows = table.content
    .map((row, index) => ({ index, cells: cellsOf(row) }))
    .filter((row) => row.cells.some((cell) => cell.text !== ""))
  const data = rows.filter((row) => row.cells.length > 1)
  const [head, second] = data
  if (!head) {
    return []
  }
  const allHeaders = head.cells.every((cell) => cell.header)
  const named = head.cells.every((cell) => isHeaderWord(cell.text))
  // One row of labels over one row of values
  if (
    data.length === 2 &&
    second?.cells.length === head.cells.length &&
    allHeaders &&
    !named &&
    head.cells.every((cell) => isLabel(cell.text))
  ) {
    return head.cells.flatMap((cell, at) =>
      tableRow(
        cell.text,
        second.cells[at]?.text ?? "",
        `${path}.content.${String(second.index)}.content.${String(at)}`,
        context
      )
    )
  }
  if (data.some((row) => row.cells.length !== 2)) {
    return []
  }
  const skipHead = allHeaders || named
  let section = context
  return rows.flatMap((row) => {
    if (row.cells.length === 1) {
      section = row.cells[0]?.text ?? context
      return []
    }
    if (skipHead && row === head) {
      return []
    }
    const [label, value] = row.cells
    return tableRow(
      label?.text ?? "",
      value?.text ?? "",
      `${path}.content.${String(row.index)}`,
      section
    )
  })
}

function visitBlock(state: State, block: Block, path: string): void {
  switch (block.type) {
    case "heading":
      visitHeading(state, runsText(block.content ?? []), block.attrs.level)
      return
    case "paragraph": {
      const lines = linesOf(block.content)
      lines.forEach((runs, index) => {
        visitLine(state, runs, lines.length === 1 ? path : `${path}.line.${String(index)}`)
      })
      return
    }
    case "bulletList":
    case "orderedList":
      visitList(state, block.content, path)
      return
    case "blockquote":
      block.content.forEach((child, index) => {
        visitBlock(state, child, `${path}.content.${String(index)}`)
      })
      return
    case "table":
      endLoose(state)
      state.rows.push(...tableFacts(block, path, state.context))
      return
    case "image":
    case "productCard":
    case "categoryCard":
      return
  }
}

/** The same label, value and section once, the first kept; at most 200. */
function distinct(rows: readonly FactRow[]): FactRow[] {
  const seen = new Set<string>()
  return rows
    .filter((row) => {
      const key = [labelKey(row.label), row.value, labelKey(row.context ?? "")].join("\u0000")
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .slice(0, MAX_ROWS)
}

/** The facts of a document's blocks, in the document's order. */
export function factsFromBlocks(blocks: readonly Block[], base = "content"): FactRow[] {
  const state: State = { rows: [], loose: [], section: null, context: null }
  blocks.forEach((block, index) => {
    visitBlock(state, block, `${base}.${String(index)}`)
  })
  endLoose(state)
  return distinct(state.rows)
}
