import type { MedusaContainer } from "@medusajs/framework/types"
import { isImageType, libraryImage } from "../library-image"

interface Row {
  id: string
  file_id: string | null
  url: string
  mime_type: string | null
}

/** A media module holding `rows`, answering the filters the helper sends (and recording them). */
function containerWith(rows: Row[]) {
  const calls: { filters: Record<string, unknown>; select: string[] }[] = []
  const listMediaAssets = (filters: Record<string, unknown>, config: { select: string[] }) => {
    calls.push({ filters, select: config.select })
    const matched = rows.filter((row) =>
      "url" in filters
        ? row.url === filters["url"] && row.file_id !== null
        : row.file_id === filters["file_id"]
    )
    return Promise.resolve(matched.slice(0, 1))
  }
  const container = { resolve: () => ({ listMediaAssets }) } as Pick<MedusaContainer, "resolve">
  return { container, calls }
}

const ROWS: Row[] = [
  { id: "m1", file_id: "logo-01.png", url: "https://cdn/logo-01.png", mime_type: "image/png" },
  { id: "m2", file_id: null, url: "https://outside/a.png", mime_type: null },
  { id: "m3", file_id: "eski-01.png", url: "https://cdn/eski-01.png", mime_type: null },
  { id: "m4", file_id: "not-01.pdf", url: "https://cdn/not-01.pdf", mime_type: "application/pdf" },
]

describe("an image in the media library (ortam kütüphanesi görseli)", () => {
  it("finds a stored upload by its storage key or its address", async () => {
    const { container } = containerWith(ROWS)
    await expect(libraryImage(container, { file_id: "logo-01.png" })).resolves.toMatchObject({
      id: "m1",
    })
    await expect(
      libraryImage(container, { url: "https://cdn/logo-01.png" })
    ).resolves.toMatchObject({ id: "m1" })
  })

  it("is none for a key with no record (an invoice, a label, a feed in storage)", async () => {
    const { container } = containerWith(ROWS)
    await expect(libraryImage(container, { file_id: "faturalar/fatura-01.pdf" })).resolves.toBe(
      null
    )
  })

  it("is none for an outside address, which has a record but no stored file", async () => {
    const { container, calls } = containerWith(ROWS)
    await expect(libraryImage(container, { url: "https://outside/a.png" })).resolves.toBeNull()
    expect(calls[0]?.filters).toEqual({ url: "https://outside/a.png", file_id: { $ne: null } })
  })

  it("is none for a record whose type is no image; an older one with no type passes", async () => {
    const { container } = containerWith(ROWS)
    await expect(libraryImage(container, { file_id: "not-01.pdf" })).resolves.toBeNull()
    await expect(libraryImage(container, { file_id: "eski-01.png" })).resolves.toMatchObject({
      id: "m3",
    })
    expect(isImageType("image/svg+xml")).toBe(true)
    expect(isImageType("text/plain")).toBe(false)
    expect(isImageType(null)).toBe(true)
  })

  it("reads the fields the caller asks for besides its own, once each", async () => {
    const { container, calls } = containerWith(ROWS)
    await libraryImage(container, { file_id: "logo-01.png" }, ["size", "mime_type"])
    expect(calls[0]?.select).toEqual(["id", "file_id", "url", "mime_type", "size"])
  })
})
