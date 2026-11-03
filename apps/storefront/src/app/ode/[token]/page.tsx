import { PaymentLinkScreen, paymentLinkMetadata } from "@/screens/payment-link"

export const metadata = paymentLinkMetadata

/**
 * `/ode/<token>` (adr/0051): the page a payment link from the shop opens
 * (e-mail, SMS, WhatsApp). `?durum=` is what "Ödemeye geç" came back with.
 */
export default async function PaymentLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ token }, query] = await Promise.all([params, searchParams])
  return <PaymentLinkScreen token={token} outcome={query["durum"]} />
}
