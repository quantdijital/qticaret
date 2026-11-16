import type { WholesaleAccount, WholesaleLine } from "./api/types"

/** A rate as Turkish writes it, its two decimals kept: 12.5 → "%12,5". */
export const ratePercent = (percent: number): string =>
  `%${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(percent)}`

/** The name a wholesaler goes by: the company, else the contact, else the address. */
export const accountTitle = (account: WholesaleAccount): string =>
  account.company_name ?? account.contact_name ?? account.email ?? account.id

/** The second line under the name: the contact when the company leads, and the address. */
export const accountSubtitle = (account: WholesaleAccount): string =>
  [account.company_name ? account.contact_name : null, account.email]
    .filter((part): part is string => Boolean(part))
    .join(" · ")

/** A line's product and variant, as one name. */
export const lineName = (line: Pick<WholesaleLine, "product_title" | "variant_title">): string =>
  [line.product_title, line.variant_title].filter(Boolean).join(" · ")
