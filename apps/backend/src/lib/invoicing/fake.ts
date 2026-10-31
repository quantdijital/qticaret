import { PDFDocument, StandardFonts } from "pdf-lib"
import { differenceOf } from "./provider"
import type { InvoiceProvider } from "./provider"

/**
 * A program for a developer's machine and the tests (adr/0034 §1): it
 * issues at once, an e-Fatura for a company and an e-Arşiv for a person,
 * numbered from the invoice's own id, its PDF a page that says it is not
 * an invoice. Never a live shop's (`fakeInvoicingAllowed`).
 */

async function fakePdf(number: string): Promise<Buffer> {
  const document = await PDFDocument.create()
  const page = document.addPage([420, 595])
  const font = await document.embedFont(StandardFonts.Helvetica)
  page.drawText("SAHTE FATURA - gecerli bir belge degildir", { x: 30, y: 540, size: 14, font })
  page.drawText(number, { x: 30, y: 515, size: 11, font })
  return Buffer.from(await document.save())
}

export const fakeInvoiceProvider: InvoiceProvider = {
  id: "fake",
  cancel: (state, now) =>
    Promise.resolve(
      !state.number ||
        (state.document_type === "e_archive" &&
          (state.cancellable_until?.getTime() ?? 0) > now.getTime())
        ? { result: "cancelled" as const }
        : { result: "too_late" as const, progress: {} }
    ),
  async advance(state, context) {
    const draft = await context.draft()
    const number = `TST${String(context.now().getUTCFullYear())}${state.id.slice(-9).toUpperCase()}`
    return {
      next: "issued",
      progress: {
        external_id: `fake-${state.id}`,
        document_id: `fake-${state.id}`,
        document_type: draft.buyer.kind === "company" ? "e_invoice" : "e_archive",
        number,
        uuid: null,
        cancellable_until:
          draft.buyer.kind === "company"
            ? null
            : // Eight days for an e-Arşiv (the shop's accountant, 2026-10-31)
              new Date(context.now().getTime() + 8 * 86_400_000),
        program_difference: differenceOf(draft, draft.totals.gross),
      },
      pdf: await fakePdf(number),
    }
  },
}
