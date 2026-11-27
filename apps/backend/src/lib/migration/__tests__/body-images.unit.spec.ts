import type { Block, ContentDoc } from "../../content/doc"
import { imageSources, insertImages, swapImages } from "../body-images"

const OLD = "https://eski.example.com/wp-content/uploads/2026/01"
const NEW = "https://cdn.dukkan.example/media"

const text = (words: string, href?: string): Block => ({
  type: "paragraph",
  content: [
    href
      ? { type: "text", text: words, marks: [{ type: "link", attrs: { href } }] }
      : { type: "text", text: words },
  ],
})
const image = (src: string, alt?: string): Block => ({
  type: "image",
  attrs: alt ? { src, alt } : { src },
})
const doc = (...content: Block[]): ContentDoc => ({ type: "doc", content })

describe("a moved body's pictures (adr/0042 Ek 2026-11-27)", () => {
  it("names each old file once, in order", () => {
    expect(
      imageSources(
        doc(image(`${OLD}/a.png`), text("x"), image(`${OLD}/b.png`), image(`${OLD}/a.png`))
      )
    ).toEqual([`${OLD}/a.png`, `${OLD}/b.png`])
  })

  it("swaps stored pictures for their copies, leaves out one not stored, points links at a copy", () => {
    const body = doc(
      text("Büyük hali", "/wp-content/uploads/2026/01/a-1024x768.png"),
      image(`${OLD}/a.png`, "A"),
      image(`${OLD}/b.png`),
      text("Başka dosya", "/wp-content/uploads/2026/01/c.pdf"),
      text("Ürün", "/urun/tava")
    )
    const swapped = swapImages(body, new Map([[`${OLD}/a.png`, `${NEW}/a.webp`]]))
    expect(swapped).toEqual(
      doc(
        text("Büyük hali", `${NEW}/a.webp`),
        image(`${NEW}/a.webp`, "A"),
        text("Başka dosya", "/wp-content/uploads/2026/01/c.pdf"),
        text("Ürün", "/urun/tava")
      )
    )
  })

  it("puts new pictures after the text they followed, the owner's edits kept", () => {
    const source = doc(
      image(`${OLD}/first.png`),
      text("Bir"),
      image(`${OLD}/a.png`, "A"),
      text("İki"),
      text("Üç"),
      image(`${OLD}/b.png`),
      image(`${OLD}/kept.png`)
    )
    // The owner rewrote "Üç" and added a line; "İki" stays
    const current = doc(text("Bir"), text("İki"), text("Üç, değişti"), text("Yeni satır"))
    const merged = insertImages(
      current,
      source,
      new Map([
        [`${OLD}/first.png`, `${NEW}/first.webp`],
        [`${OLD}/a.png`, `${NEW}/a.webp`],
        [`${OLD}/b.png`, `${NEW}/b.webp`],
      ])
    )
    expect(merged).toEqual(
      doc(
        image(`${NEW}/first.webp`),
        text("Bir"),
        image(`${NEW}/a.webp`, "A"),
        text("İki"),
        // "Üç" no longer matches: the picture follows the last text that did
        image(`${NEW}/b.webp`),
        text("Üç, değişti"),
        text("Yeni satır")
      )
    )
  })

  it("does not add a picture whose copy the text already shows", () => {
    const current = doc(text("Bir"), image(`${NEW}/a.webp`, "A"))
    const merged = insertImages(
      current,
      doc(text("Bir"), image(`${OLD}/a.png`, "A")),
      new Map([[`${OLD}/a.png`, `${NEW}/a.webp`]])
    )
    expect(merged).toEqual(current)
  })

  it("adds nothing when nothing is new", () => {
    const current = doc(text("Bir"))
    expect(insertImages(current, doc(text("Bir"), image(`${OLD}/a.png`)), new Map())).toEqual(
      current
    )
  })
})
