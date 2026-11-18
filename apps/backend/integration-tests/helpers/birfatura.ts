import { createServer } from "node:http"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { formatBirfaturaDate } from "../../src/lib/invoicing/birfatura"
import type { HttpClient, HttpResponse } from "./http"
import { settle } from "./http"

/**
 * BirFatura's side of adr/0072 for HTTP suites: its calls to the shop's
 * services, and its file server for the invoice PDFs (`BIRFATURA_BASE_URL`,
 * reached directly in tests). Tokens are made by the test shop; none is
 * written here.
 */

export const BIRFATURA_PDF = Buffer.from("%PDF-1.4\n% fatura\n%%EOF\n")

export interface BirfaturaFiles {
  origin: string
  /** The address BirFatura would send for an invoice's PDF. */
  link: (name: string) => string
  close: () => Promise<void>
}

export async function startBirfaturaFiles(): Promise<BirfaturaFiles> {
  const server: Server = createServer((req, res) => {
    if (req.url?.startsWith("/dosyagetir?")) {
      res.writeHead(200, { "content-type": "application/pdf" }).end(BIRFATURA_PDF)
    } else {
      res.writeHead(404).end()
    }
  })
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  const origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
  return {
    origin,
    link: (name) => `${origin}/dosyagetir?tur=1&guid=${name}.pdf`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve()
        })
      }),
  }
}

export interface PulledOrder {
  OrderId: number
  OrderCode: string
  BillingName: string
  BillingMobilePhone: string
  PaymentTypeId: number
  TotalPaidTaxIncluding: number
  OrderDetails: { ProductCode: string; ProductQuantity: number }[]
}

/** BirFatura's calls, with the token the shop gave it (or none). */
export function birfaturaClient(http: HttpClient) {
  const call = <T>(service: string, body: unknown, token?: string) =>
    settle(
      http.post<T>(`/hooks/birfatura/api/${service}`, body, {
        headers: token === undefined ? {} : { token },
      })
    )
  const day = 86_400_000
  return {
    call,
    /** Orders queued from yesterday to tomorrow, in the given state. */
    pull: (token: string, status = 1): Promise<HttpResponse<{ Orders: PulledOrder[] }>> =>
      call(
        "orders",
        {
          orderStatusId: status,
          startDateTime: formatBirfaturaDate(new Date(Date.now() - day)),
          endDateTime: formatBirfaturaDate(new Date(Date.now() + day)),
        },
        token
      ),
    link: (
      token: string,
      body: { orderId: number; faturaUrl: string; faturaNo?: string; faturaTarihi?: string }
    ): Promise<HttpResponse<{ Success: boolean; Message: string }>> =>
      call("invoiceLinkUpdate", body, token),
  }
}

/** A GİB number in the shop's series for this year (Türkiye's), nine digits from `serial`. */
export function gibNumber(series: string, serial: number): string {
  const year = new Date(Date.now() + 3 * 3_600_000).getUTCFullYear()
  return `${series}${String(year)}${String(serial).padStart(9, "0")}`
}
