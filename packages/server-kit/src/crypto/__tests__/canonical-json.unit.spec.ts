import { CanonicalJsonError, canonicalJson, canonicalJsonDeep } from "../canonical-json"

describe("canonicalJson", () => {
  it("sorts top-level keys only, as the stored provider settings expect", () => {
    expect(canonicalJson({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"d":1,"c":2},"b":1}')
  })
})

describe("canonicalJsonDeep", () => {
  it("sorts keys at every depth and keeps array order", () => {
    expect(canonicalJsonDeep({ b: [3, { z: 1, y: 2 }], a: { d: null, c: "x" } })).toBe(
      '{"a":{"c":"x","d":null},"b":[3,{"y":2,"z":1}]}'
    )
  })

  it("orders by code unit, not by locale", () => {
    expect(canonicalJsonDeep({ b: 1, B: 2, ç: 3, c: 4 })).toBe('{"B":2,"b":1,"c":4,"ç":3}')
  })

  it("gives the same text after a parse and serialise round trip", () => {
    const value = { serial: 7, limits: { products: 100, staff: null }, flags: { b: true } }
    const text = canonicalJsonDeep(value)

    expect(canonicalJsonDeep(JSON.parse(text))).toBe(text)
  })

  it("leaves out undefined properties", () => {
    expect(canonicalJsonDeep({ a: 1, b: undefined })).toBe('{"a":1}')
  })

  it.each([
    ["NaN", { a: Number.NaN }],
    ["Infinity", { a: Number.POSITIVE_INFINITY }],
    ["a Date", { a: new Date(0) }],
    ["a Map", { a: new Map() }],
    ["undefined in an array", { a: [undefined] }],
    ["a bigint", { a: 1n }],
    ["a function", { a: () => 1 }],
  ])("refuses %s", (_case, value) => {
    expect(() => canonicalJsonDeep(value)).toThrow(CanonicalJsonError)
  })
})
