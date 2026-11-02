import { confirmConsentByLink } from "@/app/actions/email-links"
import { EmailLinkScreen, emailLinkMetadata } from "@/screens/email-link"

export const metadata = emailLinkMetadata("consent")

/** `/abonelik/onay?t=` (adr/0038 M17, Ek 2026-11-02): a consent request's confirmation (double opt-in). */
export default function ConsentConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <EmailLinkScreen kind="consent" searchParams={searchParams} action={confirmConsentByLink} />
  )
}
