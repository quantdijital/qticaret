import { describe, expect, it } from "vitest"
import {
  formatMeasureInput,
  formatMoneyInput,
  parseMeasureInput,
  parseMoneyInput,
} from "./money-input"

describe("parseMoneyInput", () => {
  it.each([
    ["1.250,50", 1250.5],
    ["1250,5", 1250.5],
    ["1250.50", 1250.5],
    ["1250", 1250],
    ["1.250", 1250],
    ["₺ 89,90", 89.9],
    ["0,99", 0.99],
  ])("reads %s as %d", (text, amount) => {
    expect(parseMoneyInput(text)).toBe(amount)
  })

  it.each(["", "abc", "1,2,3", "12,345", "1.25.0", "-5"])("refuses %s", (text) => {
    expect(parseMoneyInput(text)).toBeNull()
  })

  it("writes an amount back the Turkish way", () => {
    expect(formatMoneyInput(1250.5)).toBe("1.250,50")
  })
})

describe("measurements", () => {
  it.each([
    ["0,125", 0.125],
    ["0.125", 0.125],
    ["1.250", 1250],
    ["12,5", 12.5],
    ["350", 350],
  ])("reads %s as %d", (text, value) => {
    expect(parseMeasureInput(text)).toBe(value)
  })

  it("refuses a fourth decimal and writes values back without grouping", () => {
    expect(parseMeasureInput("0,1255")).toBeNull()
    expect(parseMoneyInput("0,125")).toBeNull()
    expect(formatMeasureInput(0.125)).toBe("0,125")
    expect(formatMeasureInput(1250)).toBe("1250")
  })
})
