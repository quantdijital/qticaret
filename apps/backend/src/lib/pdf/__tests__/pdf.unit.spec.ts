import { PDFDocument } from "pdf-lib"
import { MM, imposePdfs, newPdf, printable, wrapText } from ".."
import { labelSheetOf } from "../../shipping/label-sheet"

const onePage = async (title: string, size: [number, number] = [100, 100], blank = false) => {
  const doc = await PDFDocument.create()
  doc.setTitle(title)
  const page = doc.addPage(size)
  if (!blank) {
    page.drawRectangle({ x: 5, y: 5, width: 20, height: 20 })
  }
  return doc.save()
}

const custom = { width_mm: 100, height_mm: 150 }
const sizes = async (pdf: Uint8Array) =>
  (await PDFDocument.load(pdf))
    .getPages()
    .map((page) => [Math.round(page.getWidth() / MM), Math.round(page.getHeight() / MM)])

describe("pdf (pdf-lib, approved 2026-10-28)", () => {
  it("prints Turkish, and anything the font lacks as a question mark", async () => {
    const { regular } = await newPdf()

    expect(printable(regular, "Ğğ Şş İı Çç Öö Üü ₺")).toBe("Ğğ Şş İı Çç Öö Üü ₺")
    expect(printable(regular, "a\u0007b 😀")).toBe("a b ?")
  })

  it("breaks text between words to fit a width", async () => {
    const { regular } = await newPdf()
    const lines = wrapText(
      regular,
      11,
      "Moda Mahallesi Atatürk Caddesi No: 5 Daire: 3 Kadıköy",
      100
    )

    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) {
      expect(line.includes(" ") ? regular.widthOfTextAtSize(line, 11) : 0).toBeLessThanOrEqual(100)
    }
    expect(lines.join(" ")).toBe("Moda Mahallesi Atatürk Caddesi No: 5 Daire: 3 Kadıköy")
  })

  it("puts every readable label on a page of the roll's size, and names the ones it could not read", async () => {
    const { pdf, skipped } = await imposePdfs(
      [
        await onePage("a"),
        Buffer.from("not a pdf"),
        await onePage("b"),
        // A carrier's label with nothing on it: no empty sticker comes out
        await onePage("c", [100, 100], true),
      ],
      labelSheetOf({ label_format: "100x100", label_custom: custom })
    )

    expect(await sizes(pdf)).toEqual([
      [100, 100],
      [100, 100],
    ])
    expect(skipped).toEqual([1, 3])
  })

  it("lays four labels to an A4 sheet, and a custom roll's size as the shop set it", async () => {
    const labels = await Promise.all(
      ["a", "b", "c", "d", "e"].map((title) => onePage(title, [100 * MM, 150 * MM]))
    )

    const a4 = await imposePdfs(labels, labelSheetOf({ label_format: "a4", label_custom: custom }))
    const roll = await imposePdfs(
      labels.slice(0, 1),
      labelSheetOf({ label_format: "custom", label_custom: { width_mm: 76, height_mm: 102 } })
    )

    expect(await sizes(a4.pdf)).toEqual([
      [210, 297],
      [210, 297],
    ])
    expect(await sizes(roll.pdf)).toEqual([[76, 102]])
  })
})
