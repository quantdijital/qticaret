/**
 * A real one-page PDF, the smallest pdf-lib reads, for fake carriers'
 * labels: a merged print of them counts their pages. Offsets are counted,
 * so the cross-reference table is right.
 */
export function tinyPdf(note: string): Buffer {
  const head = `%PDF-1.4\n% ${note.replace(/[\r\n]/g, " ")}\n`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 283 425] >>",
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
