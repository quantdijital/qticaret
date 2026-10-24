import { readZipSafely } from "../zip"
import type { ZipLimits } from "../zip"
import { buildZip } from "./fixtures"

const reasonOf = async (run: Promise<unknown>): Promise<unknown> => {
  try {
    await run
  } catch (error) {
    return (error as { safeMessage?: unknown }).safeMessage
  }
  return "accepted"
}

const LIMITS: ZipLimits = {
  maxEntries: 5,
  maxEntryBytes: 1024 * 1024,
  maxTotalBytes: 2 * 1024 * 1024,
  maxRatio: 100,
}

describe("readZipSafely", () => {
  it("reads stored and deflated entries and skips directories", async () => {
    const zip = buildZip([
      { name: "docs/", data: Buffer.alloc(0) },
      { name: "docs/a.txt", data: Buffer.from("merhaba") },
      { name: "b.csv", data: Buffer.from("x,y\n1,2\n".repeat(10)), deflate: true },
    ])

    const entries = await readZipSafely(zip, LIMITS)

    expect(entries.map((entry) => entry.name)).toEqual(["docs/a.txt", "b.csv"])
    expect(entries[0]?.data.toString()).toBe("merhaba")
  })

  it.each([
    ["a parent path", "../evil.txt"],
    ["an absolute path", "/etc/cron.d/x"],
    ["a backslash path", "..\\evil.txt"],
  ])("refuses %s", async (_label, name) => {
    expect(
      await reasonOf(readZipSafely(buildZip([{ name, data: Buffer.from("x") }]), LIMITS))
    ).toBe("zip.unsafe_entry")
  })

  it.each([
    ["a duplicate name", ["xl/workbook.xml", "xl/workbook.xml"]],
    ["names equal but for case", ["xl/workbook.xml", "XL/Workbook.xml"]],
    ["names equal but for Unicode form", ["\u00e7.txt", "c\u0327.txt"]],
  ])("refuses %s", async (_label, names) => {
    const zip = buildZip(names.map((name) => ({ name, data: Buffer.from("x") })))

    expect(await reasonOf(readZipSafely(zip, LIMITS))).toBe("zip.unsafe_entry")
  })

  it("refuses a name with control characters", async () => {
    const zip = buildZip([{ name: "a\u0007.txt", data: Buffer.from("x") }])

    expect(await reasonOf(readZipSafely(zip, LIMITS))).toBe("zip.unsafe_entry")
  })

  it("refuses a symbolic link", async () => {
    const zip = buildZip([{ name: "link", data: Buffer.from("/etc/passwd"), mode: 0o120777 }])

    expect(await reasonOf(readZipSafely(zip, LIMITS))).toBe("zip.unsafe_entry")
  })

  it("refuses too many entries", async () => {
    const zip = buildZip(
      Array.from({ length: 6 }, (_, i) => ({ name: `f${String(i)}`, data: Buffer.from("x") }))
    )

    expect(await reasonOf(readZipSafely(zip, LIMITS))).toBe("zip.too_many_entries")
  })

  it("refuses a compression bomb by its ratio", async () => {
    const zip = buildZip([{ name: "zeros", data: Buffer.alloc(900 * 1024), deflate: true }])

    expect(await reasonOf(readZipSafely(zip, LIMITS))).toBe("zip.ratio_too_high")
  })

  it("refuses an entry over the size limit", async () => {
    const zip = buildZip([{ name: "big", data: Buffer.alloc(2 * 1024 * 1024, 1) }])

    expect(await reasonOf(readZipSafely(zip, LIMITS))).toBe("zip.too_large")
  })

  it("counts every entry's bytes against the total", async () => {
    const part = Buffer.alloc(900 * 1024, 7)
    const zip = buildZip([0, 1, 2].map((i) => ({ name: `p${String(i)}`, data: part })))

    expect(await reasonOf(readZipSafely(zip, LIMITS))).toBe("zip.too_large")
  })

  it("refuses an entry whose header lies about its size", async () => {
    const zip = buildZip([
      { name: "liar", data: Buffer.from("x".repeat(5000)), deflate: true, declaredSize: 10 },
    ])

    expect(await reasonOf(readZipSafely(zip, { ...LIMITS, maxRatio: 10_000 }))).toBe("zip.invalid")
  })

  it("refuses something that is not a zip", async () => {
    expect(await reasonOf(readZipSafely(Buffer.from("not a zip"), LIMITS))).toBe("zip.invalid")
  })
})
