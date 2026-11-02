import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { giftCardsOn } from "@/lib/cart/gift"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { giftCardActions } from "@/lib/theme-actions"
import { theme } from "@/theme"

// A form for one shopper's code: nothing to index
export const metadata: Metadata = robotsOnly("noindex,nofollow", t("gift.balance_title"))

/**
 * `/hediye-karti/bakiye` (adr/0025 Ek 2026-11-03): a gift card's balance
 * by its code, sent in a form's body. Not there while the shop sells no
 * gift cards (the backend's route answers 404 then too).
 */
export default async function GiftCardBalancePage() {
  if (!(await giftCardsOn())) {
    notFound()
  }
  return (
    <theme.GiftCardBalancePage
      t={t}
      actions={giftCardActions}
      view={{
        title: t("gift.balance_title"),
        text: t("gift.balance_text"),
        breadcrumbs: [
          { label: t("home.label"), path: "/" },
          { label: t("gift.balance_title"), path: null },
        ],
      }}
    />
  )
}
