import type { Metadata } from "next"
import { restoreCart } from "@/app/actions/cart-reminder"
import { headerCart } from "@/lib/cart/cart"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("cart.restore_title"))

const TOKEN = /^[\w-]{43}$/

/**
 * `/sepet/geri-don?token=` (F10 cart reminders): the e-mail's link only
 * asks; opening it changes nothing (a mail scanner's visit spends no
 * token). The button sends the token by a Server Action.
 */
export default async function RestoreCart({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [query, current] = await Promise.all([searchParams, headerCart()])
  const token =
    typeof query["token"] === "string" && TOKEN.test(query["token"]) ? query["token"] : null
  return (
    <theme.ConfirmPage
      t={t}
      action={restoreCart}
      view={{
        title: t("cart.restore_title"),
        text: token ? t("cart.restore_text") : t("cart.link_invalid"),
        warning: token && (current?.items.length ?? 0) > 0 ? t("cart.restore_warning") : null,
        fields: token ? [{ name: "token", value: token }] : [],
        submit: t("cart.restore_submit"),
        back: { label: t("cart.continue"), path: "/" },
      }}
    />
  )
}
