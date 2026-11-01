import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { theme } from "@/theme"

export const metadata: Metadata = {
  title: { absolute: t("not_found.title") },
  robots: "noindex,follow",
}

export default function NotFound() {
  return <theme.NotFoundPage t={t} />
}
