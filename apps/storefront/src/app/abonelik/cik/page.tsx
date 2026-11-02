import { unsubscribeByLink } from "@/app/actions/email-links"
import { EmailLinkScreen, emailLinkMetadata } from "@/screens/email-link"

export const metadata = emailLinkMetadata("unsubscribe")

/** `/abonelik/cik?t=` (adr/0038 §1, Ek 2026-11-02): a campaign e-mail's way out. */
export default function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <EmailLinkScreen kind="unsubscribe" searchParams={searchParams} action={unsubscribeByLink} />
  )
}
