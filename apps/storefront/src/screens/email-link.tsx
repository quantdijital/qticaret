import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { emailLinkTitle, emailLinkView } from "@/lib/views/email-links"
import type { EmailLinkKind } from "@/lib/views/email-links"
import { theme } from "@/theme"

type Query = Record<string, string | string[] | undefined>

/** A token link's page: nobody's search result, its links not followed (backend `SYSTEM_PAGES`). */
export const emailLinkMetadata = (kind: EmailLinkKind): Metadata =>
  robotsOnly("noindex,nofollow", emailLinkTitle(kind, t))

/**
 * A message's token link (adr/0038 Ek 2026-11-02): opening it changes
 * nothing; the button sends the token by a Server Action. A broken link
 * is a page that says so (200, not indexed), never an error.
 */
export async function EmailLinkScreen({
  kind,
  searchParams,
  action,
}: {
  kind: EmailLinkKind
  searchParams: Promise<Query>
  action: (form: FormData) => Promise<void>
}) {
  const query = await searchParams
  return (
    <theme.ConfirmPage
      t={t}
      action={action}
      view={emailLinkView(kind, { token: query["t"], outcome: query["sonuc"] }, t)}
    />
  )
}
