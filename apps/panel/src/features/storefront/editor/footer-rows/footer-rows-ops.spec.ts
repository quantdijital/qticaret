import { describe, expect, it } from "vitest"
import { FOOTER_ROWS_LIMITS as L } from "@qticaret/types"
import type { FooterRow } from "@/features/storefront/api/layout"
import {
  addBlock,
  addRow,
  atOf,
  blockAt,
  blockRoom,
  duplicateBlock,
  duplicateRow,
  findBlock,
  moveBlock,
  moveRow,
  newRow,
  removeBlock,
  removeRow,
  rowRoom,
  setLayout,
  stepTarget,
} from "./footer-rows-ops"
import { newBlock } from "./footer-rows-seed"

/** Rows of `[row id, layout, [blocks of each column]]`; blocks are text blocks named by id. */
function rowsOf(...spec: [string, FooterRow["layout"], string[][]][]): FooterRow[] {
  return spec.map(([id, layout, columns]) => ({
    ...newRow(id, layout),
    columns: columns.map((ids) => ({ blocks: ids.map((each) => newBlock("text", each)) })),
  }))
}

/** Each row's columns as block ids. */
const ids = (rows: readonly FooterRow[]) =>
  rows.map((row) => row.columns.map((column) => column.blocks.map((block) => block.id)))

let counter = 0
const nextId = () => `n${++counter}`

describe("the free rows footer's changes (adr/0070 §7)", () => {
  it("finds a block, counts its place row by row, column by column", () => {
    const rows = rowsOf(["r1", "1-1", [["a", "b"], ["c"]]], ["r2", "1", [["d"]]])
    expect(findBlock(rows, "c")).toMatchObject({ row: 0, column: 1, index: 0 })
    expect(findBlock(rows, "x")).toBeNull()
    expect(atOf(rows, "d")).toBe(3)
    expect(blockAt(rows, 1)?.id).toBe("b")
    expect(blockAt(rows, 9)).toBeNull()
  })

  it("adds, removes, moves and copies rows, keeping at least one", () => {
    let rows: readonly FooterRow[] = rowsOf(["r1", "1", [["a"]]])
    expect(removeRow(rows, "r1")).toBe(rows)
    rows = addRow(rows, newRow("r2", "1-1"), 0)
    expect(rows.map((row) => row.id)).toEqual(["r2", "r1"])
    expect(rows[0]?.columns).toHaveLength(2)
    rows = moveRow(rows, "r2", 5)
    expect(rows.map((row) => row.id)).toEqual(["r1", "r2"])
    const copied = duplicateRow(rows, "r1", nextId)
    expect(copied).toHaveLength(3)
    expect(copied[1]?.id).not.toBe("r1")
    expect(copied[1]?.columns[0]?.blocks[0]?.id).not.toBe("a")
    expect(removeRow(copied, "r2").map((row) => row.id)).not.toContain("r2")
  })

  it("adds no row past the limit", () => {
    const full = rowsOf(
      ...Array.from({ length: L.rows }, (_, at): [string, "1", string[][]] => [`r${at}`, "1", [[]]])
    )
    expect(rowRoom(full)).toBe(false)
    expect(addRow(full, newRow("extra"))).toBe(full)
  })

  it("does not copy a row whose blocks would pass a type's limit", () => {
    const rows = rowsOf(["r1", "1", [[]]])
    const withBrand = addBlock(rows, { row: "r1", column: 0 }, newBlock("brand", "b"))
    expect(rowRoom(withBrand, withBrand[0])).toBe(false)
    expect(duplicateRow(withBrand, "r1", nextId)).toBe(withBrand)
  })

  it("moves the blocks of the columns let go into the last one kept", () => {
    const rows = rowsOf(["r1", "1-1-1", [["a"], ["b"], ["c"]]])
    const fewer = setLayout(rows, "r1", "1-1")
    expect(fewer.merged).toBe(true)
    expect(ids(fewer.rows)).toEqual([[["a"], ["b", "c"]]])
    const more = setLayout(fewer.rows, "r1", "1-1-1-1")
    expect(more.merged).toBe(false)
    expect(ids(more.rows)).toEqual([[["a"], ["b", "c"], [], []]])
    expect(setLayout(rows, "r1", "1-1-1").rows).toBe(rows)
  })

  it("says why a block cannot be added: its type, the footer, the column", () => {
    const rows = rowsOf(["r1", "1-1", [[], []]])
    const branded = addBlock(rows, { row: "r1", column: 0 }, newBlock("brand", "b"))
    expect(blockRoom(branded, "brand")).toBe("type")
    expect(addBlock(branded, { row: "r1", column: 1 }, newBlock("brand", "b2"))).toBe(branded)
    const column = Array.from({ length: L.perColumn }, (_, at) => `t${at}`)
    const full = rowsOf(["r1", "1-1", [column, []]])
    expect(blockRoom(full, "text", { row: 0, column: 0 })).toBe("column")
    expect(blockRoom(full, "text", { row: 0, column: 1 })).toBeNull()
    const many = rowsOf(
      ...Array.from({ length: 4 }, (_, r): [string, "1-1", string[][]] => [
        `r${r}`,
        "1-1",
        [0, 1].map((c) => Array.from({ length: 3 }, (_, at) => `b${r}${c}${at}`)),
      ])
    )
    expect(blockRoom(many, "image")).toBe("footer")
  })

  it("updates, removes and copies a block right under itself", () => {
    const rows = rowsOf(["r1", "1", [["a", "b"]]])
    const copied = duplicateBlock(rows, "a", () => "a2")
    expect(ids(copied)).toEqual([[["a", "a2", "b"]]])
    expect(ids(removeBlock(copied, "a"))).toEqual([[["a2", "b"]]])
    expect(duplicateBlock(rows, "x", nextId)).toBe(rows)
  })

  it("moves a block within its column and across rows, counted once it has left", () => {
    const rows = rowsOf(["r1", "1-1", [["a", "b", "c"], []]], ["r2", "1", [["d"]]])
    expect(ids(moveBlock(rows, "a", { row: "r1", column: 0, index: 2 }))).toEqual([
      [["b", "c", "a"], []],
      [["d"]],
    ])
    expect(ids(moveBlock(rows, "b", { row: "r2", column: 0, index: 0 }))).toEqual([
      [["a", "c"], []],
      [["b", "d"]],
    ])
    expect(moveBlock(rows, "a", { row: "r1", column: 0, index: 0 })).toBe(rows)
    expect(moveBlock(rows, "a", { row: "nope", column: 0, index: 0 })).toBe(rows)
  })

  it("puts no block into a full column", () => {
    const column = Array.from({ length: L.perColumn }, (_, at) => `t${at}`)
    const rows = rowsOf(["r1", "1-1", [column, ["x"]]])
    expect(moveBlock(rows, "x", { row: "r1", column: 0, index: 0 })).toBe(rows)
  })

  it("steps a block up and down, past a column's edge into the next one with room", () => {
    const column = Array.from({ length: L.perColumn }, (_, at) => `t${at}`)
    const rows = rowsOf(["r1", "1-1-1", [["a", "b"], column, ["c"]]], ["r2", "1", [[]]])
    expect(stepTarget(rows, "b", -1)).toEqual({ row: "r1", column: 0, index: 0 })
    // the full middle column is passed by
    expect(stepTarget(rows, "b", 1)).toEqual({ row: "r1", column: 2, index: 0 })
    expect(stepTarget(rows, "c", -1)).toEqual({ row: "r1", column: 0, index: 2 })
    expect(stepTarget(rows, "c", 1)).toEqual({ row: "r2", column: 0, index: 0 })
    expect(stepTarget(rows, "a", -1)).toBeNull()
    expect(stepTarget(rows, "x", 1)).toBeNull()
  })
})
