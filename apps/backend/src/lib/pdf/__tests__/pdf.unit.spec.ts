import { PDFDocument } from "pdf-lib"
import { mergePdfs, newPdf, printable, wrapText } from ".."

const onePage = async (title: string) => {
  const doc = await PDFDocument.create()
  doc.setTitle(title)
  doc.addPage([100, 100])
  return doc.save()
}

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

  it("puts every readable label's pages in one file, and names the ones it could not read", async () => {
    const { pdf, skipped } = await mergePdfs([
      await onePage("a"),
      Buffer.from("not a pdf"),
      await onePage("b"),
    ])

    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(2)
    expect(skipped).toEqual([1])
  })
})
