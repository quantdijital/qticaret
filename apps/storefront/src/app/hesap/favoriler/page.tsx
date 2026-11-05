import type { Metadata } from "next"
import { requireCustomer } from "@/lib/account/guard"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { accountActions } from "@/lib/theme-actions"
import { accountView, customerFavorites, startingCategories } from "@/lib/views/account"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("account.favorites"))

/**
 * `/hesap/favoriler` (F10): the customer's saved products as their cards;
 * with none yet, the shop's categories to start from.
 */
export default async function FavoritesPage() {
  const customer = await requireCustomer("/hesap/favoriler")
  const favorites = await customerFavorites()
  const categories = favorites.length === 0 ? await startingCategories() : []
  return (
    <theme.AccountPage
      t={t}
      actions={accountActions}
      view={accountView("favorites", customer, t, { favorites, categories })}
    />
  )
}
