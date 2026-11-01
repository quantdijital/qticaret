import type { Metadata } from "next"
import { customerAddresses } from "@/lib/account/auth"
import { requireCustomer } from "@/lib/account/guard"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { accountActions } from "@/lib/theme-actions"
import { accountView } from "@/lib/views/account"
import { addressSummaryOf } from "@/lib/views/checkout"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("account.addresses"))

/** `/hesap/adresler` (D8): the addresses checkout saved; the newest fills the next checkout. */
export default async function AddressesPage() {
  const customer = await requireCustomer("/hesap/adresler")
  const addresses = await customerAddresses()
  return (
    <theme.AccountPage
      t={t}
      actions={accountActions}
      view={accountView("addresses", customer, t, {
        addresses: addresses.flatMap((address) => {
          const summary = addressSummaryOf(customer.email, address)
          return summary
            ? [{ id: address.id, name: summary.name, lines: [...summary.lines, summary.phone] }]
            : []
        }),
      })}
    />
  )
}
