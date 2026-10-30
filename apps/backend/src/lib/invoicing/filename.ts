/**
 * An invoice PDF's download name: the number, letters, digits and dashes
 * only (a program's number is any text), else the record's id.
 */
export function pdfFilename(number: string | null, id: string): string {
  const safe = (number ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 40)
  return `fatura-${safe || id.replace(/[^A-Za-z0-9_-]/g, "")}.pdf`
}
