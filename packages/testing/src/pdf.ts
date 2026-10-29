/**
 * A real one-page PDF, the smallest pdf-lib reads, for fake carriers'
 * labels: a frame, "SAHTE ETIKET" and the note, so a print made from it
 * shows a label and a merged print counts its page. Offsets are counted,
 * so the cross-reference table is right.
 */
export function tinyPdf(note: string): Buffer {
  // Plain ASCII in a PDF string: no parentheses or backslashes to escape
  const text = note.replace(/[^\x20-\x7e]/g, " ").replace(/[()\\]/g, "")
  const content = [
    "q 1.5 w 10 10 263 405 re S Q",
    "BT /F1 18 Tf 20 375 Td (SAHTE ETIKET) Tj ET",
    `BT /F1 11 Tf 20 350 Td (${text}) Tj ET`,
    "BT /F1 8 Tf 20 24 Td (Gercek kargo firmasi kendi etiketini gonderir.) Tj ET",
  ].join("\n")
  const head = `%PDF-1.4\n% ${text}\n`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 283 425] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${String(Buffer.byteLength(content, "latin1"))} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let body = head
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"))
    body += `${String(index + 1)} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(body, "latin1")
  body +=
    `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n` +
    offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
  return Buffer.from(body, "latin1")
}
