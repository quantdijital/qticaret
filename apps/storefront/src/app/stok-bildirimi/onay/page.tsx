import { confirmStockAlertByLink } from "@/app/actions/email-links"
import { EmailLinkScreen, emailLinkMetadata } from "@/screens/email-link"

export const metadata = emailLinkMetadata("stock_alert")

/** `/stok-bildirimi/onay?t=` (F10.5, adr/0038 Ek 2026-11-02): a guest's stock alert confirmation. */
export default function StockAlertConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <EmailLinkScreen
      kind="stock_alert"
      searchParams={searchParams}
      action={confirmStockAlertByLink}
    />
  )
}
