import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { appearanceQuery } from "@/features/settings/api/appearance"
import { useStoreName } from "@/features/settings/api/store"

/**
 * The shop's identity at the top of the menu: its site icon when it has
 * one (the owner, 2026-11-16: square, it fits the square box the menu
 * keeps when folded), on a small tile of the page's surface, else its logo (the dark-surface one on an ink or
 * brand menu), else its initial on the brand colour. It reads the
 * appearance settings the store profile saves into, so a new icon shows
 * here at once. Its name beside it says what the picture is (`alt=""`);
 * folded, the name stays for screen readers.
 */
export function StoreMark() {
  const { t } = useTranslation()
  const storeName = useStoreName()
  const { data } = useQuery(appearanceQuery())
  const values = data?.values
  // The dark-surface logo on an ink or brand menu, falling back to the other
  const logo = !values
    ? null
    : values.sidebar === "light"
      ? values.logo_light_url
      : (values.logo_dark_url ?? values.logo_light_url)
  const icon = values?.favicon_url ?? null
  const name = storeName ?? t("app.name")

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {icon ? (
        // On the page's own surface, as an app icon: a dark drawing on a clear ground still
        // reads on an ink menu, and a light menu shows the same tile
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-background p-1">
          <img src={icon} alt="" className="size-full object-contain" />
        </span>
      ) : logo ? (
        <img src={logo} alt="" className="size-8 shrink-0 rounded-md object-contain" />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground"
        >
          {name.slice(0, 1).toLocaleUpperCase("tr")}
        </span>
      )}
      <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:sr-only">
        <span className="truncate text-sm font-semibold text-sidebar-foreground">{name}</span>
        <span className="truncate text-xs text-sidebar-muted-foreground">{t("app.subtitle")}</span>
      </div>
    </div>
  )
}
